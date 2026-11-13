# usagecontract v2.0.0

**Unified-versioning milestone.** usagecontract is now a monorepo: the npm package
(`@vijaypjavvadi/usagecontract`) and the VS Code extension (`vijaypjavvadi.usagecontract`) live in
one repository and release together from a single tag. Both are versioned together starting at
2.0.0.

> **No breaking API changes.** The 2.0.0 bump marks the unified versioning, not an incompatible
> change — code written against 1.9.0 keeps working.

Bundled since the 1.6.x line:

- Commands: `export-schema`, `mock`, and `usage-report`.
- GraphQL body inspection; `got` and `undici` HTTP-client adapters.
- `coverage --json` per-operation detail; `mock` lists its served operations on startup.
- A token-free, one-tag release pipeline — one `git tag` publishes npm **and** the VS Code
  Marketplace, creates the GitHub release, and Zenodo archives it (trusted publishing / OIDC, no
  tokens).

Full per-version history: `packages/core/CHANGELOG.md`.

Thanks to the outside contributors whose work is in this line: @awais-ur-rehman, @tnalbant,
@chinmayee5599, @agenticsymphony-tech, @sunxuquo, and @rodrigobgarcia.
