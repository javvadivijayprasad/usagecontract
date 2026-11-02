---
title: "docs: CLI reference is missing the export-schema and mock commands"
labels: ["documentation", "good first issue"]
---

**What's wrong**

The README's **"CLI reference"** section lists only `can-i-deploy`, `coverage`, and `verify`. The
`export-schema` and `mock` commands were added later and have their own sections, but they aren't
in the CLI reference block, so a reader scanning that one table misses them.

**Where to look**

- `README.md` — the "## CLI reference" code block.
- The real command signatures are in `src/cli.js` (see the `HELP` array and the `exportSchema` /
  `mockCmd` functions).

**Suggested fix**

Add `export-schema --profiles <dir> [--out <dir>] [--json]` and
`mock --profiles <dir> [--port <n>]` to the CLI reference block, with one-line descriptions
matching the `HELP` text in `src/cli.js`.

**Done when**

- [ ] The CLI reference block lists all commands the CLI actually supports.
- [ ] Descriptions match `src/cli.js`'s `HELP`.

---

**New here?** Comment to claim this and we'll assign it to you. Setup takes about five minutes —
see [CONTRIBUTING.md](https://github.com/javvadivijayprasad/usagecontract/blob/main/CONTRIBUTING.md).
No question is too small.
