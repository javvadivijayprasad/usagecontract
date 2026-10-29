---
title: "docs: GETTING-STARTED says got/undici are unsupported, but they are supported"
labels: ["documentation", "good first issue"]
---

**What's wrong**

`GETTING-STARTED.md` tells readers that only `fetch` and `axios` work, but `got` and `undici`
have been supported since 1.1.0 (`record.installGot` / `record.installUndici`, tested in
`test/clients.test.js`). Two places are stale:

- the Requirements line: "HTTP clients supported today: global `fetch` and `axios`."
- the Troubleshooting bullet: "your client isn't fetch/axios (got/undici not yet supported)".

The README already lists all four clients, so the docs contradict each other.

**How to reproduce**

Open `GETTING-STARTED.md` and compare the "Requirements" and "Troubleshooting" sections with the
"Limitations" section of `README.md` (which lists `fetch`, `axios`, `got`, and `undici`).

**Where to look**

- `GETTING-STARTED.md` — the Requirements line (around line 17) and the Troubleshooting bullet
  (around line 109).

Optionally add a short `got`/`undici` snippet mirroring the `fetch`/`axios` examples, and mention
the `export-schema` and `mock` commands.

**Done when**

- [ ] Both stale lines list all supported clients (`fetch`, `axios`, `got`, `undici`).
- [ ] The docs no longer contradict the README.
- [ ] `npm test` still passes (no code change needed).

---

**New here?** Comment to claim this and we'll assign it to you. Setup takes about five minutes —
see [CONTRIBUTING.md](https://github.com/javvadivijayprasad/usagecontract/blob/main/CONTRIBUTING.md).
No question is too small.
