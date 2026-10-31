---
title: "docs: add got and undici recording snippets to GETTING-STARTED"
labels: ["documentation", "good first issue"]
---

**What's wrong**

`GETTING-STARTED.md` section 3 ("Record usage…") shows code only for `fetch` and `axios`, even
though `got` and `undici` are supported (`record.installGot`, `record.installUndici`). The recent
fix corrected the *prose* that listed supported clients, but there are still no copy-paste
examples for got/undici, so a user of those clients has nothing to follow.

**Where to look**

- `GETTING-STARTED.md` — section 3, after the `axios` example.
- The API shapes are in `README.md` (GraphQL/clients sections) and `src/recorder.js`
  (`installGot` uses `responseType: 'json'`; `installUndici` wraps `undici.request`).

**Suggested fix**

Add two short snippets mirroring the existing fetch/axios ones:
`const client = record.installGot(got, spec)` and
`const request = record.installUndici(require('undici'), spec)`.

**Done when**

- [ ] GETTING-STARTED shows got and undici recording examples.
- [ ] The snippets match the real API (check against `test/clients.test.js`).

---

**New here?** Comment to claim this and we'll assign it to you. Setup takes about five minutes —
see [CONTRIBUTING.md](https://github.com/javvadivijayprasad/usagecontract/blob/main/CONTRIBUTING.md).
No question is too small.
