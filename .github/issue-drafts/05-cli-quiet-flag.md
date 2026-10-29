---
title: "feat(cli): add a --quiet flag to can-i-deploy (verdict only)"
labels: ["enhancement", "good first issue"]
---

**What's wrong**

`can-i-deploy` always prints the per-consumer coverage block after the verdict. In CI you often
want just the SAFE/BREAKING verdict without the coverage detail.

**How to reproduce**

```bash
npx usagecontract can-i-deploy --base base.json --candidate next.json --profiles ./profiles
# prints the verdict AND a "coverage (verdict confidence):" block, always
```

**Where to look**

- `src/cli.js`, in `canIDeploy(o)` — the text output function prints the coverage block
  (the `console.log('coverage (verdict confidence):')` loop). Gate that block behind `!o.quiet`.

**Suggested fix**

When `--quiet` is passed, print the verdict and affected consumers but skip the coverage block.
Exit codes must not change.

**Done when**

- [ ] `can-i-deploy ... --quiet` prints the verdict but not the coverage block.
- [ ] Exit codes (0 / 1 / 2) are unchanged.
- [ ] A test covers the `--quiet` path; `npm test` passes.

---

**New here?** Comment to claim this and we'll assign it to you. Setup takes about five minutes —
see [CONTRIBUTING.md](https://github.com/javvadivijayprasad/usagecontract/blob/main/CONTRIBUTING.md).
No question is too small.
