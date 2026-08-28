#!/usr/bin/env node
/**
 * Reject CI-skip directives in workflow and composite-action files.
 *
 * WHY THIS EXISTS
 * ---------------
 * `translate.yml` shipped `commit-message: "chore(i18n): update translations [skip ci]"`
 * from the day it was written. GitHub honours the skip directive on the HEAD COMMIT of a
 * branch for BOTH `push` and `pull_request` events, so every PR that workflow opened was
 * born with zero check runs and zero commit statuses -- not red, not pending, absent.
 * Branch protection showed "Expected - waiting for status" forever and seventeen of those PRs
 * were merged without a single real gate ever executing. The natural experiment is on the
 * branch itself: PR 849, whose head commit carries the directive, has one check run, and it
 * is `Auto-merge Dependabot` with conclusion `skipped`. PR 822, whose head is a
 * `Merge branch 'main'` commit written by the Update branch button and carrying no
 * directive, has twenty-one. Same branch, same token, same triggers.
 *
 * The head commit of a `create-pull-request` branch never changes, so the suppression is
 * permanent for the life of the PR.
 *
 * HOW THIS SCANS -- TWO PASSES, NEITHER SUFFICIENT ALONE
 * -----------------------------------------------------
 * The first version of this guard matched the RAW SOURCE TEXT only. That is not enough,
 * because YAML has more than one spelling for the same string. All four of these parse to
 * exactly `chore(i18n): update translations [skip ci]` and all four defeated a source-text
 * regex:
 *
 *   commit-message: "... [skip\x20ci]"       <- hex escape for the space
 *   commit-message: "... [skip\u0020ci]"     <- unicode escape for the space
 *   commit-message: "... \x5Bskip ci]"       <- hex escape for the opening bracket
 *   commit-message: "... [skip \<newline>ci]" <- double-quoted line continuation
 *
 * The fourth is the instructive one. A whitespace-normalising whole-file pass was believed
 * to close the multi-line axis; it closes the `>-` folded scalar only. A line continuation
 * leaves a literal backslash between the words, which survives normalisation and breaks
 * `\s+`. Chasing spellings one at a time is unwinnable -- there is always a fifth.
 *
 * So the load-bearing pass is PASS 2: parse the YAML and test the RESOLVED STRING VALUES,
 * which is what GitHub itself reads. Every present and future spelling of the same string
 * collapses to one value, and one comparison covers them all.
 *
 * PASS 1 (raw text) is kept, because it is not a subset of pass 2:
 *
 *   - Comments are absent from parsed YAML. A directive in a comment is harmless today but
 *     is one uncomment away from live, and a guard that cannot see it has a blind axis.
 *   - A file that fails to parse still gets read.
 *
 * PASS 2 is not a subset of pass 1 either: it sees through escapes, continuations and folds.
 * A directive has to evade BOTH to land. The union is the guard.
 *
 * KNOWN LIMIT: a directive assembled at runtime -- `commit-message: "x ${{ env.MSG }}"` --
 * is invisible to any static scan, in either pass. That case is covered by the runtime
 * auditor in scripts/assert-pr-checks-present.mjs, which observes the PR after it exists.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// GitHub's documented skip directives, as of the "Skipping workflow runs" page:
// [skip ci] [ci skip] [no ci] [skip actions] [actions skip] and ***NO_CI***.
// Matching is case-insensitive and tolerant of internal whitespace -- deliberately WIDER
// than GitHub's own literal substring match, because over-reporting a directive costs one
// review comment and under-reporting it costs an unverified merge.
const BRACKETED =
  /\[\s*(?:skip\s+ci|ci\s+skip|no\s+ci|skip\s+actions|actions\s+skip)\s*\]/gi;
const STARRED = /\*\*\*\s*NO_CI\s*\*\*\*/gi;

// Raise this when the repository gains workflows. NEVER lower it to make a red run green:
// a shrinking sweep is the failure this floor exists to catch. A guard that enumerates
// nothing reports exactly what a clean repository reports.
const MIN_SCANNED_FILES = 11;

/** Every match in one blob of text, as {text, index}. */
function findAll(text) {
  const hits = [];
  for (const re of [BRACKETED, STARRED]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) hits.push({ text: m[0], index: m.index });
  }
  return hits.sort((a, b) => a.index - b.index);
}

/**
 * PASS 1 -- raw source text. Returns [{where, text}].
 *
 * Deliberately NOT comment-stripped: a correct YAML comment stripper has to know that `#`
 * inside a quoted scalar is not a comment, and a naive one truncates
 * `commit-message: "chore: fix #123 [skip ci]"` at the `#` and reports the file clean.
 * A directive sitting in a real comment fails here too; that is the price of having no
 * blind axis, and the error message says so.
 *
 * The whitespace-normalised whole-file sub-pass catches a `>-` folded scalar, which YAML
 * folds back into `[skip ci]` but which no per-line regex can see.
 */
export function scanRaw(source) {
  const found = [];
  source.split('\n').forEach((line, i) => {
    for (const hit of findAll(line)) found.push({ where: `line ${i + 1}`, text: hit.text });
  });

  const perLineCount = found.length;
  const wholeFile = findAll(source.replace(/\s+/g, ' '));
  if (wholeFile.length > perLineCount) {
    for (const hit of wholeFile.slice(perLineCount)) {
      found.push({ where: 'folded across lines', text: hit.text.replace(/\s+/g, ' ') });
    }
  }
  return found;
}

/**
 * Walk a parsed YAML value, yielding every string it contains -- values AND keys -- with
 * the path where it was found. Keys are included because a directive can hide in one:
 * `run:` blocks, `env:` names and `with:` inputs are all just strings to the parser.
 */
function* walkStrings(node, path = '$') {
  if (typeof node === 'string') {
    yield { path, value: node };
    return;
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) yield* walkStrings(node[i], `${path}[${i}]`);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (typeof k === 'string') yield { path: `${path}.${k} (key)`, value: k };
      yield* walkStrings(v, `${path}.${k}`);
    }
  }
}

/**
 * PASS 2 -- resolved YAML string values. Returns {hits, parsed}.
 *
 * `parsed: false` means the file could not be parsed, so pass 2 could NOT verify it.
 * Callers must treat that as "unverified", never as "clean".
 */
export function scanResolved(source, yaml) {
  const docs = [];
  try {
    yaml.loadAll(source, (d) => docs.push(d));
  } catch {
    return { hits: [], parsed: false };
  }
  const hits = [];
  for (const doc of docs) {
    for (const { path, value } of walkStrings(doc)) {
      for (const hit of findAll(value)) {
        hits.push({ where: `resolved value at ${path}`, text: hit.text });
      }
    }
  }
  return { hits, parsed: true };
}

/**
 * Union of both passes, de-duplicated by the directive text so a plainly-written directive
 * -- which both passes see -- is reported once, with every place it was observed.
 */
export function scanSource(source, yaml) {
  const raw = scanRaw(source);
  const resolved = yaml ? scanResolved(source, yaml) : { hits: [], parsed: null };

  const byText = new Map();
  for (const hit of [...raw, ...resolved.hits]) {
    const key = hit.text.toLowerCase().replace(/\s+/g, ' ');
    if (!byText.has(key)) byText.set(key, { text: hit.text, where: [] });
    byText.get(key).where.push(hit.where);
  }
  return { violations: [...byText.values()], parsed: resolved.parsed };
}

/**
 * The parser is load-bearing: without it pass 2 cannot run and the guard is back to being
 * a source-text regex that four known spellings walk straight past. Resolve it explicitly
 * rather than trusting ambient resolution -- js-yaml is a declared devDependency of
 * frontend/, and this script runs from the repository root, so a bare specifier would not
 * resolve. Returns null if unavailable; the caller must exit non-zero, never report clean.
 */
async function loadYamlParser(repoRoot) {
  const candidates = [
    join(repoRoot, 'frontend', 'node_modules', 'js-yaml', 'dist', 'js-yaml.mjs'),
    join(repoRoot, 'node_modules', 'js-yaml', 'dist', 'js-yaml.mjs'),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const mod = await import(`file://${path}`);
      const yaml = mod.default ?? mod;
      if (typeof yaml.loadAll === 'function') return yaml;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/**
 * Every YAML file under .github, recursively, plus any composite action elsewhere in the
 * tree. Recursive-and-unfiltered under .github is deliberate: the previous version listed
 * `.github/workflows/*.yml` only and never once read
 * `.github/actions/setup-frontend/action.yml` or `.github/dependabot.yml` -- and
 * dependabot.yml has a `commit-message:` key of its very own. Enumerating the whole
 * directory means a new workflow, action or config cannot be silently missed by a walk
 * that was never taught about it.
 */
export function enumerateFiles(repoRoot) {
  const files = [];
  const isYaml = (f) => f.endsWith('.yml') || f.endsWith('.yaml');

  const walk = (dir, { yamlOnly }) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir).sort()) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full, { yamlOnly });
      } else if (yamlOnly ? isYaml(entry) : entry === 'action.yml' || entry === 'action.yaml') {
        files.push(full);
      }
    }
  };

  walk(join(repoRoot, '.github'), { yamlOnly: true });
  // Composite actions living outside .github are still actions.
  const before = new Set(files);
  walk(repoRoot, { yamlOnly: false });
  return [...new Set([...before, ...files])].sort();
}

/**
 * Independently re-enumerate every YAML file under .github and assert the scanned set
 * covers it. This is deliberately a SECOND, dumber implementation than enumerateFiles:
 * a walk that quietly narrows -- back to `.github/workflows/*.yml`, as the first version
 * of this guard did, never once reading `.github/actions/setup-frontend/action.yml` or
 * `.github/dependabot.yml` -- produces a clean run and a green check. Comparing the set
 * that was READ against the set that EXISTS is the only thing that tells a blind sweep
 * from an honest one.
 */
function coverageGaps(repoRoot, scanned) {
  const expected = [];
  const stack = [join(repoRoot, '.github')];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (entry.endsWith('.yml') || entry.endsWith('.yaml')) expected.push(full);
    }
  }
  const seen = new Set(scanned);
  return { gaps: expected.filter((f) => !seen.has(f)).sort(), expectedCount: expected.length };
}

function selfTest(yaml) {
  const must = [
    ['bare', 'commit-message: chore: x [skip ci]'],
    ['double-quoted', 'commit-message: "chore: x [skip ci]"'],
    ['single-quoted', "commit-message: 'chore: x [skip ci]'"],
    ['uppercase', 'commit-message: "x [SKIP CI]"'],
    ['mixed case', 'commit-message: "x [Skip Ci]"'],
    ['extra space', 'commit-message: "x [skip   ci]"'],
    ['tab inside', 'commit-message: "x [skip\tci]"'],
    ['ci skip', 'commit-message: "x [ci skip]"'],
    ['no ci', 'commit-message: "x [no ci]"'],
    ['skip actions', 'commit-message: "x [skip actions]"'],
    ['actions skip', 'commit-message: "x [actions skip]"'],
    ['starred', 'commit-message: "x ***NO_CI***"'],
    ['in a run block', '  run: git commit -m "chore: x [skip ci]"'],
    ['in an env value', '  env:\n    MSG: "release [ci skip]"'],
    // The blind axis a `#`-truncating comment stripper would create.
    ['after a # inside a string', 'commit-message: "chore: fix #123 [skip ci]"'],
    // The blind axis a per-line regex would create. Both passes catch this one.
    ['folded across lines', 'commit-message: >-\n  chore: x [skip\n  ci]'],
    // The four spellings that a source-text regex resolves to `[skip ci]` and misses.
    // Each is caught by pass 2 ONLY -- deleting the resolved pass makes all four go dark.
    ['hex-escaped space', 'commit-message: "chore: x [skip\\x20ci]"'],
    ['unicode-escaped space', 'commit-message: "chore: x [skip\\u0020ci]"'],
    ['hex-escaped bracket', 'commit-message: "chore: x \\x5Bskip ci]"'],
    ['line continuation', 'commit-message: "chore: x [skip \\\n  ci]"'],
    // A directive in a block scalar, which no escape trick needs.
    ['literal block scalar', 'commit-message: |\n  chore: x\n  [skip ci]'],
    // Key position, not value position.
    ['in a key', '"[skip ci]": true'],
  ];
  const mustNot = [
    ['no brackets', 'commit-message: "we do not skip ci here"'],
    ['no space', 'commit-message: "x [skipci]"'],
    ['different word', 'commit-message: "x [skipped ci]"'],
    ['trailing content in bracket', 'commit-message: "x [skip ci and more]"'],
    ['ordinary workflow line', '  run: npm run lint'],
    ['a real workflow', 'name: CI\non: [push]\njobs:\n  a:\n    runs-on: ubuntu-latest'],
  ];

  let bad = 0;
  let resolvedOnly = 0;
  for (const [label, src] of must) {
    if (scanSource(src, yaml).violations.length === 0) {
      console.error(`  self-test MISS  (should have been caught): ${label}`);
      bad += 1;
    } else if (scanRaw(src).length === 0) {
      // Proves pass 2 is doing work no source-text regex can do.
      resolvedOnly += 1;
    }
  }
  for (const [label, src] of mustNot) {
    if (scanSource(src, yaml).violations.length !== 0) {
      console.error(`  self-test FALSE POSITIVE: ${label}`);
      bad += 1;
    }
  }

  // A resolved pass that catches nothing the raw pass missed is a resolved pass that is
  // not running. Assert it earns its place, so silently breaking it cannot read as green.
  if (resolvedOnly < 4) {
    console.error(
      `  self-test FAILED: the resolved-YAML pass caught ${resolvedOnly} case(s) the raw ` +
        'pass missed, expected at least 4. Pass 2 is not doing its job.',
    );
    bad += 1;
  }

  if (bad > 0) {
    console.error(`\nself-test FAILED: ${bad} case(s). The scanner is not trustworthy.`);
    return false;
  }
  console.log(
    `self-test passed: ${must.length} caught (${resolvedOnly} only by the resolved-YAML ` +
      `pass), ${mustNot.length} correctly ignored`,
  );
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const rootArg = args.find((a) => a.startsWith('--root='));
  const repoRoot = rootArg
    ? rootArg.slice('--root='.length)
    : fileURLToPath(new URL('..', import.meta.url));

  const yaml = await loadYamlParser(repoRoot);
  if (!yaml) {
    console.error('ERROR: could not load the js-yaml parser -- the resolved-value pass cannot run.');
    console.error(
      'Without it this guard is a source-text regex, and four known spellings of the same\n' +
        'directive walk straight past a source-text regex. Run `npm ci` in frontend/ first.\n' +
        'A guard that cannot see is not a guard that found nothing.',
    );
    process.exit(2);
  }

  // The scanner has to prove it can see a directive before its silence means anything.
  // A regex that matches nothing looks exactly like a repository with nothing to find.
  if (!selfTest(yaml)) process.exit(2);
  if (args.includes('--self-test-only')) return;

  const files = enumerateFiles(repoRoot);

  // An empty or shrinking sweep is the bug class this guard exists to close. Green over
  // nothing is not green.
  if (files.length === 0) {
    console.error(`ERROR: no workflow or action files found under ${repoRoot} -- nothing was scanned.`);
    console.error('A guard that enumerates an empty universe cannot report anything.');
    process.exit(2);
  }
  if (files.length < MIN_SCANNED_FILES) {
    console.error(
      `ERROR: scanned ${files.length} file(s), floor is ${MIN_SCANNED_FILES}. ` +
        'The sweep shrank; the walk is broken or files moved out from under it.',
    );
    for (const f of files) console.error(`  enumerated: ${relative(repoRoot, f)}`);
    process.exit(2);
  }

  // Cross-check the walk against an independent enumeration. A narrowed walk exits 2 here
  // rather than reporting clean over the files it stopped reading.
  const { gaps, expectedCount } = coverageGaps(repoRoot, files);
  if (gaps.length > 0) {
    console.error(
      `ERROR: the walk read ${files.length} file(s) but ${expectedCount} YAML file(s) exist ` +
        'under .github. These were never scanned:',
    );
    for (const f of gaps) console.error(`  ${relative(repoRoot, f).split(sep).join('/')}`);
    console.error('\nA guard is only as wide as the set it enumerates.');
    process.exit(2);
  }

  // Print the enumerated set. A blind axis and a clean one produce identical exit codes,
  // so the only way to tell them apart is to say out loud what was actually read.
  console.log(`scanned ${files.length} workflow/action file(s):`);
  for (const f of files) console.log(`  ${relative(repoRoot, f).split(sep).join('/')}`);

  const violations = [];
  const unparseable = [];
  for (const file of files) {
    const rel = relative(repoRoot, file).split(sep).join('/');
    const { violations: hits, parsed } = scanSource(readFileSync(file, 'utf8'), yaml);
    if (parsed === false) unparseable.push(rel);
    for (const hit of hits) violations.push({ file: rel, ...hit });
  }

  // A file pass 2 could not read is UNVERIFIED, not clean.
  if (unparseable.length > 0) {
    console.error('\nERROR: these files could not be parsed as YAML, so the resolved-value');
    console.error('pass could not verify them. Unverified is not clean:\n');
    for (const f of unparseable) console.error(`  ${f}`);
    process.exit(2);
  }

  if (violations.length > 0) {
    console.error('\nCI-skip directive found:\n');
    for (const v of violations) {
      console.error(`  ${v.file}  ->  ${v.text}`);
      for (const w of v.where) console.error(`      seen at: ${w}`);
    }
    console.error(`
A CI-skip directive in a commit message suppresses workflow runs for BOTH the
push and the pull_request event. A pull request whose head commit carries one is
created with zero check runs -- branch protection sits at "Expected - waiting for
status" and the only way to land it is an admin override of a PR that no gate has
ever inspected. That is how seventeen translation PRs merged unverified.

If the intent was to avoid a loop, express it as a path or branch filter on the
workflow's trigger, which is visible and reviewable, not as a directive hidden in
a commit message.

This scan reads both the raw text and the parsed YAML, and does not exempt
comments, so writing the directive in a comment fails too. Refer to it in prose
instead.
`);
    process.exit(1);
  }

  console.log('\nno CI-skip directives found');
}

// Only run when executed directly, so tests can import the scanning functions without
// the module scanning the repository as an import side effect.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
