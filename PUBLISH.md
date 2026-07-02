# Publish checklist (usagecontract)

Everything is release-ready. Follow these steps once. Commands are PowerShell (Windows).

## Prerequisites
- A GitHub account, and `git` installed.
- An npm account (`npm adduser` if you don't have one).
- Node >= 18.

## 0. Set your GitHub username (replaces the javvadivijayprasad placeholders)

```powershell
$u = "YOUR_GITHUB_USERNAME"
foreach ($f in "README.md","CITATION.cff","package.json","action.yml") {
  (Get-Content $f -Raw) -replace "javvadivijayprasad", $u | Set-Content $f
}
```

Verify none remain:

```powershell
Select-String -Path README.md,CITATION.cff,package.json,action.yml -Pattern "javvadivijayprasad"
```

## 1. Confirm the name is free on npm

```powershell
npm view usagecontract    # a 404 "not found" means the name is available
```

If taken, pick another name and update `name` in package.json (and the folder/URLs).

## 2. Final local check

```powershell
npm install
npm test
npm run test:coverage
npm pack --dry-run        # review the file list (should be ~14 files, no node_modules)
```

## 3. Git init + first commit

```powershell
git init
git add .
git commit -m "usagecontract 1.0.0: usage-aware, spec-anchored contract testing"
git branch -M main
```

## 4. Create the GitHub repo and push

With the GitHub CLI (`gh`):

```powershell
gh repo create usagecontract --public --source . --remote origin --push
```

Or manually: create an empty repo named `usagecontract` on github.com, then:

```powershell
git remote add origin https://github.com/$u/usagecontract.git
git push -u origin main
```

CI (`.github/workflows/ci.yml`) runs on push — you should see the tests + coverage go green.

## 5. Publish to npm

```powershell
npm login
npm publish --access public
```

Verify:

```powershell
npm view usagecontract version
npm install -g usagecontract   # optional smoke test
usagecontract --help
```

## 6. Tag a release (and enable the Action)

```powershell
git tag v1.0.0
git push --tags
```

Then on GitHub: Releases -> Draft a new release -> tag `v1.0.0` -> Publish.
- If you add an `NPM_TOKEN` repo secret, the `publish.yml` workflow will publish future
  releases automatically.
- To let people use the Action as `YOUR_NAME/usagecontract@v1`, also push a moving major tag:
  `git tag -f v1 && git push -f --tags`.

## 7. (Optional) Announce

- Dev.to / Hacker News "Show HN" / Reddit r/node using the blurb below.
- Submit to `awesome-contract-testing` and `awesome-openapi` lists.

---

### Launch blurb (copy/paste)

> **usagecontract — catch the API changes that actually break your consumers, without writing a
> contract.** It watches your existing tests, learns which response fields each consumer really
> reads, and fails CI only when a spec change breaks a consumer that truly depends on the changed
> field. No DSL, no broker, no duplicate contract file. On real OpenAPI specs, schema-diff tools
> are right only ~17-22% of the time they alarm; usagecontract reaches ~100% precision by
> conditioning on real usage. `npm i -D usagecontract`.

---

### What's in this repo
- `src/` — the package (recorder, compatibility engine, coverage, CLI)
- `bin/` — the `usagecontract` CLI
- `test/` — 31 tests (unit + real HTTP integration); ~97% coverage, enforced in CI
- `action.yml` — GitHub Action for `can-i-deploy`
- `README.md`, `GETTING-STARTED.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `CITATION.cff`

Tip: the runnable two-team demo lives in `../demo-project` — consider pushing it as a separate
`usagecontract-demo` repo or copying it into an `examples/` folder here.
