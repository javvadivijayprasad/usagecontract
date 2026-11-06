---
title: "feat(cli): mock should log the operations it serves on startup"
labels: ["enhancement", "good first issue"]
---

**What's wrong**

When you run `usagecontract mock --profiles ./profiles`, it prints only "listening on …" and the
number of profiles. It doesn't tell you **which operations** it will answer, so you have to guess
the routes to call.

**How to reproduce**

```bash
npx usagecontract mock --profiles ./profiles
# prints the port and profile count, but not the list of served operations
```

**Where to look**

- `src/cli.js` — `mockCmd(o)` prints the startup lines.
- `src/mock.js` — `responsesFor(profiles)` returns an object keyed by operation
  (e.g. `"GET /orders/{id}"`); those keys are exactly the list to print.

**Suggested fix**

After starting the server, print each served operation (one per line), e.g. `  GET /orders/{id}`.
Keep it short.

**Done when**

- [ ] `mock` logs the served operations on startup.
- [ ] A test covers the helper that produces the operation list (if you factor one out);
      `npm test` passes.

---

**New here?** Comment to claim this and we'll assign it to you. Setup takes about five minutes —
see [CONTRIBUTING.md](https://github.com/javvadivijayprasad/usagecontract/blob/main/CONTRIBUTING.md).
No question is too small.
