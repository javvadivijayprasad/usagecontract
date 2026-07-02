# Getting started with usagecontract

You are a **consumer app** team (e.g. `web-app`) that calls a provider API described by an
OpenAPI spec. In ~5 minutes you'll have a check that fails CI when the provider makes a change
that breaks *your* app.

## 1. Install

After it's published:

```bash
npm install --save-dev usagecontract
```

(Before publishing / to try the local copy: `npm install --save-dev ../path/to/usagecontract`.)

Requirements: Node >= 18. HTTP clients supported today: global `fetch` and `axios`.

## 2. Get the provider's OpenAPI spec

Save the API's spec somewhere in your repo, e.g. `specs/orders.openapi.json`.
(It's the same file the provider publishes; you don't write anything.)

## 3. Record usage from your existing tests (2 lines)

You do NOT write a contract. You let your normal tests run through the recorder.

Using **fetch**:

```js
const { record } = require('usagecontract');
const spec = require('./specs/orders.openapi.json');

beforeAll(() => { record.install(spec); record.start({ provider: 'orders', specRef: 'orders@1.0.0' }); });
afterAll(() => record.flush('web-app', { dir: './profiles' }));

// ...your existing tests that call the API run unchanged...
```

Using **axios** (attach the adapter to your instance):

```js
const { record } = require('usagecontract');
const axios = require('axios');
const spec = require('./specs/orders.openapi.json');

const api = axios.create({ baseURL: process.env.API_URL });
beforeAll(() => { record.installAxios(api, spec); record.start({ provider: 'orders', specRef: 'orders@1.0.0' }); });
afterAll(() => record.flush('web-app', { dir: './profiles' }));
// use `api` in your tests as usual
```

Works with any test runner (Jest, Vitest, `node --test`, Mocha). `record.start`/`flush` just need
to bracket the run.

## 4. Run your tests -> a profile appears

```bash
npm test
```

This writes `profiles/web-app.profile.json` — the fields your app actually reads. Commit it
(or publish it to a shared folder/bucket your provider's CI can read).

## 5. Gate provider changes in CI

Whenever the provider proposes a new spec, check it against your recorded profile:

```bash
npx usagecontract can-i-deploy \
  --base ./specs/orders.openapi.json \
  --candidate ./specs/orders.openapi.next.json \
  --profiles ./profiles \
  --min-coverage 70
```

- Exits **0** and prints `SAFE` if the change doesn't touch anything you use.
- Exits **1** and names the broken consumer if it does.
- Also prints coverage; `--min-coverage` fails the build if your tests are too thin to trust.

In GitHub Actions:

```yaml
- uses: javvadivijayprasad/usagecontract@v1.0.0
  with:
    base: ./specs/orders.openapi.json
    candidate: ./specs/orders.openapi.next.json
    profiles: ./profiles
```

## Where does this run?

Two common setups:
- **Consumer-side:** you record profiles; your provider's release pipeline pulls the shared
  profiles and runs `can-i-deploy` before shipping a spec change.
- **Monorepo:** provider and consumers live together; one CI job records all profiles, then gates.

## Contributor build/test (working ON usagecontract itself)

```bash
git clone <repo> && cd usagecontract
npm install
npm test        # runs node --test (unit + real HTTP integration tests)
npm run example # end-to-end can-i-deploy demo
```

## Troubleshooting

- **Empty profile / nothing recorded:** your client isn't fetch/axios (got/undici not yet
  supported), or `record.start()` didn't run before the requests.
- **`file not found`:** check the `--base`/`--candidate`/`--profiles` paths.
- **Low coverage warning:** your tests don't exercise much of the API; add tests or record from
  a broader run before trusting a SAFE verdict.
