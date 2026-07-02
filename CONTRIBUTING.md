# Contributing to usagecontract

Thanks for your interest! usagecontract is early (0.1 alpha) and contributions are welcome.

## Dev setup
```bash
npm install
npm test          # unit tests
npm run example   # end-to-end demo
```

## Good first issues
- HTTP client adapters beyond global `fetch` (axios, undici, XMLHttpRequest).
- Registry backends (S3/GCS) behind the existing interface.
- Enum-exhaustiveness detection (static analysis or an `exhaustive` annotation).
- GraphQL support (a selection set is a usage profile).

## Guidelines
- Keep the core dependency-free where possible.
- Add a test for every behavior change (`node --test`).
- Discuss larger designs in an issue first.
