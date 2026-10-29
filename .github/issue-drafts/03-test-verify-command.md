---
title: "test(cli): add tests for the verify command"
labels: ["chore", "good first issue"]
---

**What's wrong**

The CLI `verify` command (check that every recorded profile is satisfied by a spec) has no
tests. `test/cli.test.js` covers `can-i-deploy`, `coverage`, `--help`, and the missing-file case,
but not `verify`.

**How to reproduce**

Look at `test/cli.test.js` — there's no `main(['verify', ...])` test. `src/cli.js` has a
`verify(o)` function that returns 0 (all satisfied), 1 (some incompatible), or 2 (bad args).

**Where to look**

- `src/cli.js` — the `verify(o)` function.
- `test/cli.test.js` — follow the existing `fixture()` + `quiet()` pattern to add tests.

**Suggested fix**

Add tests that: (a) a spec satisfying the profile returns 0; (b) a spec missing a consumed field
returns 1; (c) missing `--spec`/`--profiles` returns 2.

**Done when**

- [ ] New tests cover the 0 / 1 / 2 exit codes of `verify`.
- [ ] `npm test` passes and coverage stays above the floor (`npm run test:coverage`).

---

**New here?** Comment to claim this and we'll assign it to you. Setup takes about five minutes —
see [CONTRIBUTING.md](https://github.com/javvadivijayprasad/usagecontract/blob/main/CONTRIBUTING.md).
No question is too small.
