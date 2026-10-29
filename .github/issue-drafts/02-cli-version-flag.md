---
title: "feat(cli): add a --version flag"
labels: ["enhancement", "good first issue"]
---

**What's wrong**

`usagecontract --version` does not print the version. Because the CLI only special-cases
`--help`, passing `--version` falls through to the "unknown command" branch:

```
$ npx usagecontract --version
unknown command: --version
... (help text) ...
```

It should print the package version and exit 0, like most CLIs.

**How to reproduce**

```bash
npx usagecontract --version   # prints "unknown command", exit code 2
```

**Where to look**

- `src/cli.js`, in `main()` next to the existing `--help` / `-h` check (around line 111).
- The version is in `package.json` (`require('../package.json').version`).

**Suggested fix**

Handle `--version` / `-v` right after the `--help` check: print the version and `return 0`.

**Done when**

- [ ] `usagecontract --version` (and `-v`) prints the current version and exits 0.
- [ ] A test in `test/cli.test.js` asserts `main(['--version'])` returns 0.
- [ ] `npm test` passes.

---

**New here?** Comment to claim this and we'll assign it to you. Setup takes about five minutes —
see [CONTRIBUTING.md](https://github.com/javvadivijayprasad/usagecontract/blob/main/CONTRIBUTING.md).
No question is too small.
