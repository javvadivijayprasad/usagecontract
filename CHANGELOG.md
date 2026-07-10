# Changelog

## 1.1.0
- HTTP client adapters for **got** and **undici** (`record.installGot`, `record.installUndici`),
  in addition to fetch and axios.
- Test suite: 33 tests.

## 1.0.0
- Test suite: 31 tests (compat, recorder proxy, coverage, registry, CLI, real HTTP integration),
  ~97% line coverage enforced in CI via npm run test:coverage (90% lines / 75% branches / 90% funcs).
- Traffic recorder: derives per-consumer usage profiles from existing tests. HTTP clients: global
  fetch and axios (via record.installAxios).
- Compatibility engine: usage-relative breaking-change detection (removal, rename, type change,
  required->optional, newly-required param).
- `can-i-deploy` and `verify` CLIs with precise blast radius and CI-friendly exit codes.
- OpenAPI 3.0/3.1 resolver with $ref, allOf (merge), and oneOf/anyOf (branch) support.
- Local folder registry ("the broker is a bucket").
- Coverage reporting: can-i-deploy shows per-consumer field coverage and warns on low
  confidence; `coverage` command and `--min-coverage` CI floor.
