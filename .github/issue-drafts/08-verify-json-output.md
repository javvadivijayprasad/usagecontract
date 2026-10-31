---
title: "feat(cli): add --json output to the verify command"
labels: ["enhancement", "good first issue"]
---

**What's wrong**

`can-i-deploy` and `coverage` both support `--json` for machine-readable output, but `verify`
does not — it only prints human text. CI pipelines that want to parse the result of `verify` have
nothing structured to read.

**How to reproduce**

```bash
npx usagecontract verify --spec spec.json --profiles ./profiles --json
# --json is ignored; only the text form is printed
```

**Where to look**

- `src/cli.js` — the `verify(o)` function. Use the existing `emit(json, obj, textFn)` helper (see
  how `coverageCmd` / `canIDeploy` do it) to print `{ ok, incompatible: [...] }` when `--json` is set.

**Done when**

- [ ] `verify ... --json` prints a parseable object (e.g. `{ ok, incompatible: [{ consumer, violations }] }`).
- [ ] Exit codes (0 / 1 / 2) are unchanged.
- [ ] A test in `test/cli.test.js` covers the `--json` path; `npm test` passes.

---

**New here?** Comment to claim this and we'll assign it to you. Setup takes about five minutes —
see [CONTRIBUTING.md](https://github.com/javvadivijayprasad/usagecontract/blob/main/CONTRIBUTING.md).
No question is too small.
