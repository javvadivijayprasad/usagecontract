# Changelog

## 1.4.0
- **GraphQL body inspection**: a request body of the form `{ query, variables }` is inspected
  directly — the query's selection set becomes read dependencies and the variables become send
  dependencies. Runs automatically for GraphQL `POST`s through a patched global `fetch`, or call
  `record.graphql(body)` explicitly. New `parseGraphQL(query)` helper exposes the parse. No new
  runtime dependency (the parser is built-in).
- Test suite: 62 tests.

## 1.3.0
- **Cross-run profile merging**: `record.flush(consumer, { merge: true })` unions with an existing
  profile on disk (accumulate across test runs / CI shards); `record.merge(a, b)` helper.
- **Enum-exhaustiveness annotation** (opt-in): `record.start({ exhaustive: [{ op, field }] })` marks
  a read dep as exhaustively-matched and auto-populates its enum from the spec, so a widened enum is
  correctly flagged breaking for that consumer — closing the previously-disclosed blind spot.
- Test suite: 44 tests.

## 1.2.0
- Spec **registry**: store provider specs by ref (`orders@1.2.0`); `can-i-deploy` resolves each
  consumer's baseline automatically from `--registry` (no manual `--base` needed).
- Multi-provider gating (`--provider`, inferred from the candidate spec title).
- `--json` output for `can-i-deploy` and `coverage`.
- `push` / `pull` commands to publish/fetch specs and profiles via the registry.
- Test suite: 39 tests.

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
