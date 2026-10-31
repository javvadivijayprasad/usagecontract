---
title: "docs: document the --version / -v flag in the README and CLI help"
labels: ["documentation", "good first issue"]
---

**What's wrong**

The CLI now supports `--version` / `-v` (added in 1.7.0), but it isn't documented anywhere: the
`HELP` text in `src/cli.js` doesn't mention it, and the README's "CLI reference" doesn't list it.
A user running `usagecontract --help` won't discover the flag.

**How to reproduce**

```bash
npx usagecontract --help     # no mention of --version / -v
```
Then look at the "CLI reference" section of `README.md` — also no `--version`.

**Where to look**

- `src/cli.js` — the `HELP` array (add a line for `--version` / `-v`).
- `README.md` — the "CLI reference" section.

**Done when**

- [ ] `usagecontract --help` mentions `--version` / `-v`.
- [ ] The README CLI reference lists it.
- [ ] `npm test` passes (no behavior change).

---

**New here?** Comment to claim this and we'll assign it to you. Setup takes about five minutes —
see [CONTRIBUTING.md](https://github.com/javvadivijayprasad/usagecontract/blob/main/CONTRIBUTING.md).
No question is too small.
