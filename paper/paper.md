---
title: 'usagecontract: Usage-aware, spec-anchored contract testing that derives per-consumer contracts from observed traffic'
tags:
  - JavaScript
  - Node.js
  - contract testing
  - OpenAPI
  - microservices
  - consumer-driven contracts
  - continuous delivery
authors:
  - name: Vijay Prasad Javvadi
    orcid: 0009-0004-1192-6906
    affiliation: 1
affiliations:
  - name: Independent Researcher, Plainsboro, NJ, USA
    index: 1
date: 8 August 2026
bibliography: paper.bib
---

# Summary

`usagecontract` is a Node.js library and CLI that automates consumer-driven contract testing for HTTP APIs by *observing* rather than *authoring*. During a consumer's existing test run, `usagecontract` patches the HTTP client (`fetch`, `axios`, `got`, or `undici`) and records which OpenAPI response fields, request parameters, and operations that consumer actually exercises. The result is a per-consumer *usage profile* (a JSON file) that captures the derived contract without any DSL, hand-written pact, or contract broker. When the provider proposes a new OpenAPI specification, the `can-i-deploy` command compares the candidate spec against every recorded profile and reports precisely which consumers (if any) break, including a blast-radius summary and per-consumer coverage figures.

# Statement of need

Two families of tools dominate the API-compatibility gate in continuous-delivery pipelines, and each has a well-known failure mode. Consumer-driven contract testing frameworks such as Pact [@pactFoundation] deliver precise "who breaks?" answers but require every consumer team to hand-author a contract in a DSL and to run a broker service; this authoring cost is a durable adoption barrier. Schema-diff tools such as `openapi-diff` [@openapiDiff] require no authoring but treat the OpenAPI specification as if every field mattered to every consumer, producing high false-alarm rates: on real-world OpenAPI corpora the fraction of schema-diff alarms that a downstream consumer actually reads is only ~17--22%.

`usagecontract` occupies the empty quadrant between these two options: it needs no DSL and no broker (like schema-diff), yet it conditions every alarm on real per-consumer usage (like Pact). Because profiles are derived from tests that the consumer team was already going to run, the marginal setup cost is a two-line install into the test bootstrap. The library targets microservices teams practising continuous delivery, platform teams that publish shared APIs to many internal consumers, and provider owners who need a low-noise, high-precision gate before shipping an OpenAPI change.

# Functionality

The recorder API (`record.install`, `record.installAxios`, `record.installGot`, `record.installUndici`) attaches to the relevant HTTP client, and `record.start({ provider, specRef })` / `record.flush(name, { dir })` bracket a recording window. During that window the recorder walks each response against the provided OpenAPI schema, marking every reached field, operation, and request parameter; the resulting `<consumer>.profile.json` is checked into the consumer repository. Profiles may be merged across CI shards or sessions with `record.flush(name, { dir, merge: true })`, and enum exhaustiveness --- which cannot be inferred from traffic --- can be opted in per operation and field via `record.start({ exhaustive: [...] })`.

The CLI exposes three subcommands. `usagecontract can-i-deploy --base <spec> --candidate <spec> --profiles <dir>` gates a provider release, exiting 0 (safe), 1 (breaking for at least one consumer or below the `--min-coverage` floor), or 2 (bad input). `usagecontract coverage --spec <spec> --profiles <dir>` reports how much of each operation each consumer exercised. `usagecontract verify --spec <spec> --profiles <dir>` checks that every recorded profile is satisfied by the current spec. A registry mode (`push`, `pull`) stores each provider spec version so that `can-i-deploy` can resolve every consumer's baseline automatically from its profile's `specRef` --- the "registry" being simply a folder of JSON files that may be committed or synced to object storage. A GitHub Action wrapper (`javvadivijayprasad/usagecontract@v1`) exposes the gate to hosted CI. OpenAPI 3.0 and 3.1 are supported, including `$ref`, `allOf` inheritance, `oneOf`/`anyOf` polymorphism, and nested objects and arrays.

A change is classified as **breaking for a consumer** iff the consumer's recorded profile was satisfiable under the base spec but not under the candidate: a read field or operation is removed or renamed, a type becomes incompatible, a read field becomes optional, a request parameter becomes newly required, or (for opted-in operations) an exhaustively-consumed enum is widened.

# Comparison to existing tools

Compared to Pact [@pactFoundation], `usagecontract` eliminates the DSL-authoring cost and the broker service by deriving the contract from observed traffic; the per-consumer precision is retained. Compared to schema-diff tools such as `openapi-diff` [@openapiDiff], `usagecontract` retains the "no authoring" property while gaining consumer-conditioning, which sharply reduces false alarms on fields that no consumer reads. Compared to record-and-replay proxies such as VCR-style cassettes, `usagecontract` records *field-level usage against a schema*, not raw response bodies, so its profiles remain small, diffable, and semantically comparable across spec versions. Compared to Spring Cloud Contract [@springCloudContract], which is JVM-centric and DSL-driven, `usagecontract` targets Node.js consumers and requires no DSL. The project's own comparison table in the README summarises these tradeoffs.

# Availability and reuse

`usagecontract` is published on npm as `usagecontract` (author scope `@vijaypjavvadi/usagecontract`) and its source is developed openly on GitHub at <https://github.com/javvadivijayprasad/usagecontract>. The package is released under the MIT license, requires Node.js >= 18, and ships as a CommonJS module with a bundled CLI (`bin/usagecontract.js`) and a companion GitHub Action (`action.yml`). Tests are run with Node's built-in test runner (`npm test`); a coverage floor of 90% lines / 75% branches / 90% functions is enforced via `npm run test:coverage`. A `GETTING-STARTED.md` walkthrough and an end-to-end example (`npm run example`) accompany the library. A tagged release is archived on Zenodo [FILL: paste Zenodo DOI once the v1.3.0 archival deposit is minted].

# Acknowledgments

The author thanks the OpenAPI Initiative and the Pact community for foundational work on API contract testing, and the early adopters whose feedback drove the multi-client recorder (fetch / axios / got / undici) and the registry mode.

# References
