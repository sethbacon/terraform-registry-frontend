# Releasing

Releases are automated by [release-please](https://github.com/googleapis/release-please).

## How it works

Every commit that lands on `main` with a Conventional Commit type runs
`release-please.yml`. release-please reads the commit history since the last
tag, determines the semver bump (`feat` → minor, `fix`/`perf`/`security` →
patch, `feat!` / `BREAKING CHANGE:` footer → major), updates `CHANGELOG.md` and
`frontend/package.json`, and keeps an open PR titled
`chore(main): release X.Y.Z`. The PR stays open and accumulates entries as more
commits land. Merging it is the release action.

## Cutting a release

1. Review the open release-please PR (titled `chore(main): release X.Y.Z`).
   Verify the CHANGELOG entries and version bump look correct.
2. **Merge the PR** (squash merge). release-please uses the
   `terraform-registry-release-bot` GitHub App token to push the tag, which
   bypasses the `GITHUB_TOKEN` downstream-trigger restriction.
3. `release.yml` fires automatically from the tag push:
   - Runs the full CI suite.
   - Builds and pushes the Docker image to `ghcr.io`.
   - Attests SLSA provenance and signs with cosign (keyless).
   - Creates the GitHub Release with generated release notes.
   - Updates the wiki version badge (opens an issue if this step fails).
4. After the release, update deployment configs in the backend repo:
   - **Helm chart** (in `deployments/helm/`): update `frontend.image.tag` in `values.yaml`, `values-aks.yaml`, `values-eks.yaml`, and `values-gke.yaml`.
   - **Kustomize overlays** (in `deployments/kubernetes/overlays/`): update the frontend `newTag` in `eks/kustomization.yaml` and `gke/kustomization.yaml`.
   - Add a row to `deployments/COMPATIBILITY.md` recording the new backend/frontend pair.

## Hotfix flow

1. Create a `fix/` branch from `main`.
2. Merge the PR (Conventional Commit title: `fix: <description>`).
3. release-please will bump the patch version in the open release PR.
4. If the fix is urgent, merge the release PR immediately; otherwise let it
   accumulate with other pending changes.

## Manual fallback (if release-please fails)

1. Check the release-please bot run logs in the Actions tab.
2. If the manifest is stale, update `.release-please-manifest.json` to the
   current released version and re-run the `Release Please` workflow dispatch.
3. To tag and release manually:
   ```bash
   git tag -a vX.Y.Z origin/main -m "Release vX.Y.Z"
   git push origin vX.Y.Z
   # release.yml fires from the tag push
   ```
4. If release.yml did not fire (e.g., tag was pushed by GITHUB_TOKEN):
   ```bash
   gh workflow run release.yml -f tag=vX.Y.Z --ref vX.Y.Z
   ```

## GitHub App key rotation

The `terraform-registry-release-bot` App private key is stored as
`RELEASE_DISPATCH_APP_KEY` (repository secret). To rotate:

1. In the GitHub App settings, generate a new private key and download it.
2. Update `RELEASE_DISPATCH_APP_KEY` in the repository's Actions secrets.
3. Delete the old private key from the GitHub App settings.
4. Verify by dispatching `release-please.yml` manually.

## Rollback

release-please does not support automated rollback. To undo a release:

1. Revert the breaking commit(s) on `main` with a `revert:` commit.
2. release-please will propose a new patch release that includes the revert.
3. For Docker image rollback, re-tag the previous good image as `latest` in
   the GitHub Container Registry.
4. Update deployment configs to point to the previous image tag.
