# Releasing usagecontract

One repo, one tag, two published artifacts (npm + VS Code Marketplace), plus a GitHub release that
Zenodo archives. **No tokens**: npm and the Marketplace both use *trusted publishing* (the
workflow's GitHub OIDC identity). Every publish step checks first and skips if that version is
already out, so re-running a failed run is always safe.

## The routine

1. **`npm run preflight`** at the repo root — runs both packages' tests + the core coverage floor.
   Green locally, or stop.
2. **Bump the version in both packages to the same number** and update the changelog/notes:
   - `packages/core/package.json` (version)
   - `packages/vscode/package.json` (version)
   - `packages/core/CHANGELOG.md` (move `## Unreleased` → the new version)
   - `packages/core/CITATION.cff` and root `CITATION.cff` (version + date-released; keep them byte-identical)
   - `RELEASE_NOTES.md` (the GitHub release body)
   Then run `npm install` to refresh the single root `package-lock.json`, and commit the lock with the bump.
3. **Commit the named files** (never `git add -A`) and push to `main`; wait for the `check` job to go green.
4. **`git tag vX.Y.Z && git push origin vX.Y.Z`** — the `publish` job runs: npm, Marketplace, GitHub
   release. Zenodo archives the release on its own.

Verify: `npm view @vijaypjavvadi/usagecontract version`; the Marketplace page for
`vijaypjavvadi.usagecontract`; the repo's Releases page; a new version under the concept DOI on
Zenodo. Nothing to edit afterward.

## One-time setup (browser, no tokens)

1. **npm trusted publisher** — npmjs.com → the package → Settings → Trusted Publisher → GitHub
   Actions, repo `usagecontract`, workflow `release.yml`.
2. **Marketplace trusted publishing** — marketplace.visualstudio.com/manage → publisher
   `vijaypjavvadi` → Trusted Publishing → repo `usagecontract`, workflow `release.yml`.
3. **Zenodo** — zenodo.org → GitHub → enable the switch for `usagecontract`.
4. **Delete old repo secrets** — `NPM_TOKEN`, `VSCE_PAT` (nothing uses them now).

## Rules

- Both package versions **and** the tag must match, or the `publish` job fails its version check.
- The agent prepares files; Vijay runs every git push, tag, and the browser setups. No token is ever
  typed into a chat, a file, or a workflow.
- After the first release, add the Zenodo **concept DOI** to `CITATION.cff` (root + core,
  byte-identical) and the README badge — a docs-only commit, no new release.
- A pre-release tag (`vX.Y.Z-rc.1`) publishes nothing; use `workflow_dispatch` with `dry_run=true`
  to rehearse.
