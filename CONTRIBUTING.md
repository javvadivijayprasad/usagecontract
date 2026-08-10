# Contributing to usagecontract

Thanks for your interest — contributions are welcome. Please also read our
[Code of Conduct](./CODE_OF_CONDUCT.md); by participating you agree to abide by it.
For help using the tool (rather than changing it), see [SUPPORT.md](./SUPPORT.md).

## Dev setup

```bash
npm install
npm test          # unit tests (node --test)
npm run example   # end-to-end demo
```

Node 18+ is required. The core is dependency-free; HTTP-client adapters load
their client lazily so it stays an optional peer.

## Testing rule

Every behavior change ships with a test, and the suite must stay green with the
coverage floor held. CI enforces it — a pull request that drops coverage below
the configured line/branch/function floor will fail. Run locally before pushing:

```bash
node --test --experimental-test-coverage
```

## Good first issues

- Additional HTTP-client adapters behind the existing patcher interface.
- Registry backends (S3/GCS) behind the existing `registry` interface.
- GraphQL support (a selection set is a usage profile).
- TypeScript type definitions (`.d.ts`) for the public API.

See [ROADMAP.md](./ROADMAP.md) for what is already planned.

## Guidelines

- Keep the core dependency-free where possible.
- Add a test for every behavior change (`node --test`) and keep coverage above
  the floor.
- Discuss larger designs in an issue first — open one with the `enhancement`
  label describing the use case before the API.
- Use [Conventional Commits](https://www.conventionalcommits.org) for commit
  messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## Reporting security issues

Please do not open a public issue for a suspected vulnerability. Email
jvijayprasad@gmail.com instead.
