# usagecontract

[![npm](https://img.shields.io/npm/v/usagecontract.svg)](https://www.npmjs.com/package/usagecontract)
[![CI](https://github.com/javvadivijayprasad/usagecontract/actions/workflows/ci.yml/badge.svg)](https://github.com/javvadivijayprasad/usagecontract/actions)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](package.json)

**Catch the API changes that actually break your consumers — without writing a single contract.**

usagecontract watches your existing tests, learns which response fields each consumer *actually
reads*, and fails CI only when a provider spec change breaks a consumer that truly depends on the
changed field. You get Pact-style "who breaks?" precision with the cost of a linter: no DSL, no
duplicate contract file, no broker.

> `1.0.0`. Node ≥ 18. HTTP clients: `fetch`, `axios`, `got`, and `undici`.
> **New here?** Read **[GETTING-STARTED.md](GETTING-STARTED.md)** for the full walkthrough.

---

## Why

A schema (OpenAPI) says what an API response *may* contain. It does **not** say what any consumer
*depends on*. So the two common tools each fall short:

| | Pact | openapi-diff (schema-diff) | **usagecontract** |
|---|---|---|---|
| Knows which consumer breaks | yes (hand-written) | no | **yes (auto)** |
| Contract authoring | DSL, per field | none | **none (recorded)** |
| False alarms on unused fields | no | **many** | **none** |
| Extra service to run | broker + DB | none | **none** |
| Single source of truth | no (spec + pact JSON) | yes | **yes** |

On real OpenAPI specs, schema-diff tools are right only ~17–22% of the times they raise an alarm
(the rest are changes no consumer uses). usagecontract reaches ~100% precision by conditioning on
real usage. See the [paper](#citation).

---

## How it works

```mermaid
flowchart LR
  A[consumer tests] -->|recorder| B[usage profile]
  S[provider OpenAPI spec] --> R[(registry: git folder / bucket)]
  B --> R
  R --> C[can-i-deploy]
  C --> V[verdict + blast radius + coverage]
```

1. **Record.** Your normal tests run through a recorder that observes which fields each consumer
   reads. That produces a `*.profile.json` — the *derived contract*. Nobody authors it.
2. **Gate.** When the provider proposes a new spec, `can-i-deploy` compares it against every
   recorded profile and reports exactly which consumers (if any) break.

A change is **breaking for a consumer** iff its recorded profile was satisfiable under the old spec
but not the new one: a field/operation it reads is removed or renamed, a type becomes incompatible,
a read field becomes optional, or a request parameter becomes newly-required.

---

## Install

```bash
npm install --save-dev usagecontract
```

---

## Usage

### 1. Record a consumer's usage (in its tests)

**fetch:**

```js
const { record } = require('usagecontract');
const spec = require('./specs/orders.openapi.json');

beforeAll(() => { record.install(spec); record.start({ provider: 'orders', specRef: 'orders@1.0.0' }); });
afterAll(() => record.flush('web-app', { dir: './profiles' }));

// your existing tests that call the API run unchanged
```

**axios** (attach the adapter to your instance):

```js
const { record } = require('usagecontract');
const axios = require('axios');
const spec = require('./specs/orders.openapi.json');

const api = axios.create({ baseURL: process.env.API_URL });
beforeAll(() => { record.installAxios(api, spec); record.start({ provider: 'orders', specRef: 'orders@1.0.0' }); });
afterAll(() => record.flush('web-app', { dir: './profiles' }));
```

Works with any runner (Jest, Vitest, `node --test`, Mocha). Run your tests, then commit the
generated `profiles/web-app.profile.json`.

**got / undici:** same idea via `record.installGot(gotInstance, spec)` (use `responseType: 'json'`)
or `const request = record.installUndici(require('undici'), spec)`.

### 2. Gate provider changes (CLI)

```bash
npx usagecontract can-i-deploy \
  --base ./specs/orders.openapi.json \
  --candidate ./specs/orders.openapi.next.json \
  --profiles ./profiles \
  --min-coverage 70
```

```
BREAKING: 1 of 3 consumer(s) affected:
  - web-app: total (field-removed-or-renamed)
  safe: batch-reconciler, mobile-lite
coverage (verdict confidence - how much each consumer exercised the API):
  ! coverage web-app  43% (3/7 fields)  unread: currency, id, items[].qty, ...
```

Exit code `0` = safe, `1` = breaking (or below coverage floor), `2` = bad input.

### 3. GitHub Action

```yaml
- uses: javvadivijayprasad/usagecontract@v1.0.0
  with:
    base: ./specs/orders.openapi.json
    candidate: ./specs/orders.openapi.next.json
    profiles: ./profiles
```

---

## CLI reference

```
usagecontract can-i-deploy --base <spec> --candidate <spec> --profiles <dir> [--min-coverage <0-100>]
    Fail if the candidate spec breaks any recorded consumer. Prints blast radius + coverage.

usagecontract coverage --spec <spec> --profiles <dir> [--min-coverage <0-100>]
    Report how much of each operation each consumer exercised. Fail below the threshold.

usagecontract verify --spec <spec> --profiles <dir>
    Check every recorded profile is satisfied by the spec.
```

## Registry mode (no manual `--base`)

Store each provider spec version in a registry; `can-i-deploy` then resolves every consumer's
baseline automatically from its profile `specRef`:

```bash
usagecontract push --registry ./registry --spec ./orders.openapi.json --ref orders@1.0.0
usagecontract push --registry ./registry --profiles ./profiles
usagecontract can-i-deploy --registry ./registry --candidate ./orders.openapi.next.json --profiles ./profiles
```

Add `--json` to `can-i-deploy` / `coverage` for machine-readable output. `push` / `pull` sync
specs and profiles so provider and consumer CI can share them. `--provider` (or the candidate
spec title) scopes a run to one provider when the registry holds several.

## Programmatic API

```js
const { record, compat, isBreaking, coverage } = require('usagecontract');

record.install(spec);                  // patch fetch
record.installAxios(axiosInstance, spec); // or attach to axios
record.start({ provider, specRef });   // begin a recording
const profile = record.stop('web-app'); // -> profile object
record.flush('web-app', { dir });      // stop + write to a folder

compat(spec, profile);                 // { compatible, violations }
isBreaking(beforeSpec, afterSpec, profile); // { breaking, violations }
coverage(spec, profile);               // { pct, read, reachable, perOp }
```

## GraphQL

For GraphQL, the query's **selection set is the usage profile** — it already declares exactly what
the consumer depends on, so no response tracking is needed. GraphQL `POST`s made through a patched
global `fetch` are inspected automatically; you can also record a body directly:

```js
const { record, parseGraphQL } = require('usagecontract');

record.start({ provider: 'orders', specRef: 'orders@1' });
record.graphql({ query: 'query GetOrder($id: ID!){ order(id:$id){ id items { sku } } }',
                 variables: { id: 'o1' } });
const profile = record.stop('web-app');
// read deps: order, order.id, order.items, order.items.sku   send deps: id

parseGraphQL('{ me { id } }'); // { type, name, variables, fields } — the parser on its own
```

Aliases resolve to the underlying field name, inline fragments are followed, and variables become
send dependencies. The parser is built-in (no `graphql` package required).

## Where does this run?

- **Consumer-side:** consumers record profiles; the provider's release pipeline pulls the shared
  profiles and runs `can-i-deploy` before shipping a spec change.
- **Monorepo:** one CI job records all profiles, then gates.

The "registry" is just a folder of JSON files (commit them, or sync to an S3/GCS bucket).

## OpenAPI support

`$ref`, `allOf` (inheritance), `oneOf`/`anyOf` (polymorphism), nested objects, arrays of objects
and scalars. OpenAPI 3.0 and 3.1.

## Limitations

- A profile reflects only **exercised** paths; untested consumer code is invisible. Pair with
  built-in coverage reporting and accumulate across runs with `record.flush(name, { merge: true })`.
- **Enum exhaustiveness** can't be inferred from traffic, so it is **opt-in**: mark such deps with
  `record.start({ exhaustive: [{ op, field }] })` and a widened enum is flagged breaking for them.
- HTTP clients: `fetch`, `axios`, `got`, and `undici`. GraphQL over `fetch` is inspected from the
  request body (see [GraphQL](#graphql)).

## Advanced

**Accumulate coverage across CI shards / runs** — union each run into the same profile:

```js
afterAll(() => record.flush('web-app', { dir: './profiles', merge: true }));
```

**Exhaustive enums** — if a consumer switches on every value of an enum, opt it in so a widened
enum is treated as breaking for that consumer:

```js
record.start({ provider: 'orders', specRef: 'orders@1.0.0',
  exhaustive: [{ op: 'GET /orders/{id}', field: 'status' }] });
```

## Development

```bash
npm test              # run the test suite (node --test)
npm run test:coverage # enforce coverage floor (90% lines / 75% branches / 90% funcs)
npm run example       # end-to-end demo
```

## Citation

If you use usagecontract, please cite it (see [CITATION.cff](CITATION.cff)):

```
Prasad, V. (2026). usagecontract: usage-aware, spec-anchored contract testing (v1.0.0) [Software].
```

Underlying method: *"Usage-Aware, Spec-Anchored Contract Testing: Deriving Consumer Contracts from
Observed Traffic"* (preprint / under submission).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs welcome.

## License

MIT — see [LICENSE](LICENSE).
