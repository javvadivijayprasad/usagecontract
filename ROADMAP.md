# Roadmap

usagecontract follows semver: features land in minor releases, fixes in patches.

## Shipped
- **1.0.0** — recorder (fetch + axios), compatibility engine, blast radius, coverage reporting,
  `can-i-deploy` / `coverage` / `verify` CLIs, GitHub Action, OpenAPI `$ref`/`allOf`/`oneOf`.
- **1.1.0** — `got` and `undici` recorder adapters.

## Planned
- **1.2.0** — `can-i-deploy` resolves the baseline spec by version from the registry (drop manual
  `--base`); S3/GCS registry backends.
- **1.3.0** — cross-run / CI-shard profile merging; opt-in enum-exhaustiveness annotation.
- **1.4.0** — TypeScript type declarations; optional production-traffic sampling.
- **2.0.0** — GraphQL support (a selection set is a usage profile); gRPC/events after.

Ideas and contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).
