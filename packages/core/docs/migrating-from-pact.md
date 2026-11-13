# Migrating a Pact suite to usagecontract

This guide walks through moving an existing [Pact](https://docs.pact.io) consumer suite to
usagecontract. The two tools solve the same problem — *stop a provider change from silently
breaking a consumer* — but from opposite directions:

- **Pact**: the consumer **authors** expectations in a DSL. Those expectations double as a mock
  during consumer tests and as a contract the provider must replay.
- **usagecontract**: the consumer **authors nothing**. A recorder watches your existing tests and
  derives the contract from the fields each consumer actually reads.

So migration is mostly *deletion*: the hand-written interactions go away, and your normal tests
become the source of truth.

## Concept mapping

| Pact | usagecontract |
|---|---|
| Interaction / expectation (DSL) | Usage profile, **derived** from real test traffic |
| `pact` mock server | `usagecontract mock` (generated from profiles) |
| Pact file (`consumer-provider.json`) | `web-app.profile.json` |
| Pact Broker (+ database) | A folder of JSON (git, or an S3/GCS bucket) |
| Provider verification (`@pact/verifier`) | `usagecontract can-i-deploy` against the new spec |
| `can-i-deploy` (Pact CLI) | `usagecontract can-i-deploy` |
| Provider states | *not needed* — you test against real/near-real responses |
| Matchers (`like`, `eachLike`, `term`) | *not authored* — types are observed from responses |

## Before: a Pact consumer test

```js
const { PactV3, MatchersV3 } = require('@pact-foundation/pact');
const { like, eachLike } = MatchersV3;
const { getOrder } = require('../src/ordersClient');

const provider = new PactV3({ consumer: 'web-app', provider: 'orders' });

describe('orders client', () => {
  it('fetches an order', () => {
    provider
      .given('order o1 exists')
      .uponReceiving('a request for order o1')
      .withRequest({ method: 'GET', path: '/orders/o1' })
      .willRespondWith({
        status: 200,
        body: {
          id: like('o1'),
          status: like('PENDING'),
          total: like(9.5),
          items: eachLike({ sku: like('A1') }),
        },
      });

    return provider.executeTest(async (mock) => {
      const order = await getOrder(mock.url, 'o1');
      expect(order.total).toBe(9.5);
    });
  });
});
```

Every field the consumer relies on is written twice: once in the `willRespondWith` body, and
again (implicitly) in the assertions. Keeping that body in sync with the real API is the
maintenance cost usagecontract removes.

## After: the same test with usagecontract

Delete the interaction DSL. Wrap the test in the recorder and point the client at either the real
provider, a fixture server, or `usagecontract mock`:

```js
const { record } = require('usagecontract');
const spec = require('../specs/orders.openapi.json'); // the provider's OpenAPI spec
const { getOrder } = require('../src/ordersClient');

beforeAll(() => {
  record.install(spec);                                  // patch fetch (or installAxios/Got/Undici)
  record.start({ provider: 'orders', specRef: 'orders@1.0.0' });
});
afterAll(() => record.flush('web-app', { dir: './profiles' }));

describe('orders client', () => {
  it('fetches an order', async () => {
    const order = await getOrder(process.env.ORDERS_URL, 'o1');
    expect(order.total).toBe(9.5);                       // your real assertion; the recorder notes total, id, ...
  });
});
```

Run the test. `./profiles/web-app.profile.json` now contains exactly the fields the consumer read
(`id`, `total`, `items[].sku`, …) — the derived contract. Commit it.

> **No provider to call during the test?** That's what Pact's mock did for you. Use
> `usagecontract mock --profiles ./profiles` (or a small fixture server) so the client has
> something to hit. The mock serves schema-valid data for exactly the recorded operations.

## Provider side: verification → can-i-deploy

Pact verification replays the consumer's interactions against the running provider. usagecontract
instead compares the provider's **new spec** against every recorded profile — no running provider,
no provider states:

```bash
# Pact:      run the provider, then @pact/verifier against the broker
# usagecontract:
npx usagecontract can-i-deploy \
  --base ./specs/orders.openapi.json \
  --candidate ./specs/orders.openapi.next.json \
  --profiles ./profiles
```

Exit `0` = safe, `1` = a consumer breaks (with the exact field + reason), `2` = bad input — the
same gate you had, dropped into the provider's release pipeline.

## Broker → registry

The Pact Broker is a service with a database. usagecontract's "broker is a bucket": a folder of
JSON files you commit or sync.

```bash
# publish a spec version and the consumer profiles
usagecontract push --registry ./registry --spec ./specs/orders.openapi.json --ref orders@1.0.0
usagecontract push --registry ./registry --profiles ./profiles

# provider CI resolves each consumer's baseline automatically from its specRef
usagecontract can-i-deploy --registry ./registry --candidate ./specs/orders.openapi.next.json --profiles ./profiles
```

## Incremental migration

You don't have to switch in one commit:

1. **Add the recorder alongside Pact.** Wrap your existing consumer tests with `record.install` /
   `record.flush` while the Pact DSL still runs. You now produce both a pact file and a profile.
2. **Gate on usagecontract in CI (non-blocking).** Run `can-i-deploy` and print the verdict
   without failing the build, so you can compare it against Pact verification for a few releases.
3. **Flip the gate.** Once you trust the profiles, make `can-i-deploy` blocking and remove the
   Pact verification job.
4. **Delete the DSL.** Remove `willRespondWith` bodies and matchers; the tests keep working because
   they were always driving real requests and assertions.

## What you gain, what to watch

**Gain:** no DSL, no second artifact to keep in sync, no broker service, and zero false alarms on
fields no consumer reads.

**Watch:**
- A profile only reflects **exercised** code paths. Pair with the built-in
  [coverage report](../README.md#cli-reference) and accumulate across runs with
  `record.flush(name, { merge: true })` so a thinly-tested consumer doesn't look "safe" by omission.
- **Enum exhaustiveness** isn't observable from one traffic sample — opt in per field with
  `record.start({ exhaustive: [{ op, field }] })`.
- usagecontract does **not** do request matching or provider states. If your Pact suite depended on
  asserting *request* bodies in detail, keep those as ordinary assertions in your tests.

See the [README](../README.md) for the full API and CLI reference.
