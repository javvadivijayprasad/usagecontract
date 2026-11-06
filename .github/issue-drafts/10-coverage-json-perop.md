---
title: "feat(cli): include per-operation detail in coverage --json output"
labels: ["enhancement", "good first issue"]
---

**What's wrong**

`usagecontract coverage --json` only emits `{ consumer, pct }` per consumer, while the **text**
output also shows which fields each operation left unread. CI tooling that consumes the JSON can't
see the per-operation detail that a human reading the text gets.

**How to reproduce**

```bash
npx usagecontract coverage --spec spec.json --profiles ./profiles --json
# each consumer shows only consumer + pct, no perOp / unread fields
```

**Where to look**

- `src/cli.js` — the `coverageCmd(o)` function. The `coverage()` result already contains `perOp`
  (with `unread` arrays); the text branch prints it but the JSON branch drops it.

**Suggested fix**

Include `perOp` (or at least the `unread` fields per operation) in the JSON object, matching what
the text output shows.

**Done when**

- [ ] `coverage --json` includes per-operation unread detail.
- [ ] A test in `test/` asserts the JSON shape; `npm test` passes.

---

**New here?** Comment to claim this and we'll assign it to you. Setup takes about five minutes —
see [CONTRIBUTING.md](https://github.com/javvadivijayprasad/usagecontract/blob/main/CONTRIBUTING.md).
No question is too small.
