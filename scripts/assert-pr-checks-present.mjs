#!/usr/bin/env node
/**
 * Assert that pull requests actually have CI attached to them.
 *
 * THE HOLE THIS EXISTS TO FILL
 * ----------------------------
 * The natural place to detect "this PR ran no checks" is a check. That guard cannot
 * possibly fire, because the condition it detects is the condition that stops it running.
 * A CI-skip directive on a branch's head commit suppresses `push` AND `pull_request`
 * workflow runs alike, so a `pull_request`-triggered assertion is suppressed by the very
 * thing it is looking for. It is not merely unreliable, it is inert exactly when needed.
 *
 * So the assertion has to be driven by an event that a commit message cannot suppress.
 * GitHub's skip keywords apply to `push` and `pull_request` only. This script is therefore
 * driven by `schedule` (see .github/workflows/pr-ci-presence.yml), which no commit message
 * can suppress, and additionally called in-band by translate.yml straight after it opens a
 * PR, to remove the scheduler's latency for the one producer known to have caused this.
 *
 * `pull_request_target` was considered as the immune trigger and rejected: whether the skip
 * keywords apply to it is not something the documentation settles, and building the only
 * load-bearing guard on an unverified assumption is how the original bug survived. It also
 * runs with a base-context token, which is a hazard this repository's workflow-security gate
 * exists to keep out.
 *
 * BLIND VERSUS CLEAN
 * ------------------
 * "No PR is missing its checks" and "I cannot see check runs at all" produce the same
 * silence. Before trusting any zero, this script proves it can observe a non-zero: it walks
 * back the default branch until it finds a commit that DOES have check runs. If it cannot
 * find one, it exits 2 (blind) rather than 0 (clean).
 *
 * Usage:
 *   node scripts/assert-pr-checks-present.mjs                  audit every open PR
 *   node scripts/assert-pr-checks-present.mjs --pr 123         audit one PR, poll for it
 *   node scripts/assert-pr-checks-present.mjs --pr 123 --wait 0   audit one PR, no polling
 *
 * Env: GITHUB_REPOSITORY (owner/repo), GITHUB_TOKEN (optional; only raises the rate limit --
 * check runs and statuses are world-readable on a public repository, so this guard cannot be
 * blinded by narrowing a token).
 *
 * Exit codes: 0 clean, 1 a PR has no checks, 2 the guard could not see (blind / bad input).
 */

const API = 'https://api.github.com';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const REPO = process.env.GITHUB_REPOSITORY || arg('--repo');
const GRACE_MIN = Number(process.env.GRACE_MINUTES || arg('--grace', '15'));
const PR_ONLY = arg('--pr');
const WAIT_MIN = Number(arg('--wait', PR_ONLY ? '10' : '0'));

if (!REPO || !REPO.includes('/')) {
  console.error('ERROR: set GITHUB_REPOSITORY (owner/repo) or pass --repo owner/repo');
  process.exit(2);
}

async function gh(path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'pr-ci-presence' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`${API}${path}`, { headers });
  if (!res.ok) {
    // An API failure is NOT an empty result. Treating it as one is how a guard goes quietly
    // green over a universe it never managed to read.
    throw new Error(`GitHub API ${res.status} ${res.statusText} for ${path}`);
  }
  return res.json();
}

/** check-runs + commit statuses on one SHA. */
async function coverage(sha) {
  const [checks, status] = await Promise.all([
    gh(`/repos/${REPO}/commits/${sha}/check-runs?per_page=1`),
    gh(`/repos/${REPO}/commits/${sha}/status`),
  ]);
  return { checkRuns: checks.total_count ?? 0, statuses: status.total_count ?? 0 };
}

/**
 * Prove the check-runs axis is observable at all. Without this, a permanently broken
 * reader reports every PR as fine.
 */
async function proveNotBlind(defaultBranch) {
  const commits = await gh(`/repos/${REPO}/commits?sha=${defaultBranch}&per_page=30`);
  if (!Array.isArray(commits) || commits.length === 0) {
    console.error(`ERROR: no commits enumerated on ${defaultBranch} -- cannot self-verify.`);
    process.exit(2);
  }
  for (const c of commits) {
    const { checkRuns, statuses } = await coverage(c.sha);
    if (checkRuns > 0 || statuses > 0) {
      console.log(
        `vision check: ${c.sha.slice(0, 8)} on ${defaultBranch} has ` +
          `${checkRuns} check run(s) / ${statuses} status(es) -- the guard can see checks`
      );
      return;
    }
  }
  console.error(
    `ERROR: none of the last ${commits.length} commits on ${defaultBranch} has a single ` +
      'check run or status.\nThis guard cannot distinguish "every PR is covered" from ' +
      '"I am unable to observe checks", so it refuses to report clean.'
  );
  process.exit(2);
}

const ageMinutes = (iso) => (Date.now() - new Date(iso).getTime()) / 60000;

async function evaluate(pr) {
  const sha = pr.head.sha;
  const commit = await gh(`/repos/${REPO}/commits/${sha}`);
  const committedAt = commit.commit.committer?.date || commit.commit.author?.date;
  const { checkRuns, statuses } = await coverage(sha);
  return {
    number: pr.number,
    title: pr.title,
    sha,
    checkRuns,
    statuses,
    ageMin: ageMinutes(committedAt),
    covered: checkRuns > 0 || statuses > 0,
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const repo = await gh(`/repos/${REPO}`);
  const defaultBranch = repo.default_branch;

  await proveNotBlind(defaultBranch);

  let prs;
  if (PR_ONLY) {
    prs = [await gh(`/repos/${REPO}/pulls/${PR_ONLY}`)];
  } else {
    prs = await gh(`/repos/${REPO}/pulls?state=open&base=${defaultBranch}&per_page=100`);
  }

  // Say the size out loud. A run that inspected nothing must not read like a run that
  // inspected everything and approved it.
  console.log(`inspecting ${prs.length} pull request(s) against ${defaultBranch}`);
  if (prs.length === 0) {
    console.log('no open pull requests -- nothing to assert');
    return 0;
  }

  const deadline = Date.now() + WAIT_MIN * 60000;
  const POLL_SECONDS = 30;
  let results = [];
  for (;;) {
    results = [];
    for (const pr of prs) results.push(await evaluate(pr));

    const uncovered = results.filter((r) => !r.covered);
    if (uncovered.length === 0) break;
    if (Date.now() >= deadline) break;

    console.log(
      `  ${uncovered.length} PR(s) still without checks; re-checking in ` +
        `${POLL_SECONDS}s (up to ${WAIT_MIN}m)`
    );
    await sleep(POLL_SECONDS * 1000);
  }

  for (const r of results) {
    const mark = r.covered ? 'ok  ' : 'NONE';
    console.log(
      `  ${mark} #${r.number} ${r.sha.slice(0, 8)} checks=${r.checkRuns} ` +
        `statuses=${r.statuses} age=${r.ageMin.toFixed(0)}m  ${r.title}`
    );
  }

  // When asked about one specific PR, waiting it out and still seeing nothing IS the failure;
  // the grace window has already been spent in the polling loop.
  const failing = PR_ONLY
    ? results.filter((r) => !r.covered)
    : results.filter((r) => !r.covered && r.ageMin >= GRACE_MIN);

  if (failing.length > 0) {
    console.error('\nPull requests with NO check runs and NO commit statuses:\n');
    for (const r of failing) {
      console.error(`  #${r.number}  ${r.sha}  (head is ${r.ageMin.toFixed(0)} minutes old)`);
      console.error(`    https://github.com/${REPO}/pull/${r.number}`);
    }
    console.error(`
Nothing has inspected these branches. Branch protection will show every required
context as "Expected - waiting for status" indefinitely, which can only be cleared
by an admin override -- a merge no gate has ever seen.

The usual cause is a CI-skip directive in the head commit's message, which suppresses
push and pull_request workflow runs alike. Check with:

  gh api repos/${REPO}/commits/<sha> --jq .commit.message

scripts/check-workflow-ci-skip.mjs rejects that directive in workflow files. If the
message is clean, look instead at the workflow triggers and their branch filters.
`);
    return 1;
  }

  console.log('\nevery inspected pull request has CI attached');
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`ERROR: ${err.message}`);
    process.exit(2);
  }
);
