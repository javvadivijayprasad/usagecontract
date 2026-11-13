'use strict';
// End-to-end integration: a mock PROVIDER app (serves order data AND publishes its own
// OpenAPI spec) and two mock CONSUMER apps (web + mobile) that read different fields.
// The consumers record usage profiles to disk over the real network; the real CLI then
// gates a breaking spec change. The point: the SAME change is breaking for the consumer
// that reads the removed field and safe for the one that doesn't (usage-relative gating),
// proven through the full pipeline: provider -> consumer traffic -> profiles -> CLI verdict.
const test = require('node:test'); const assert = require('node:assert');
const http = require('http');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { record, isBreaking } = require('../src/index');
const { main } = require('../src/cli');

const SPEC = {
  openapi: '3.0.0', info: { title: 'orders', version: '1' },
  paths: { '/orders/{id}': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } } } } } },
  components: { schemas: { Order: { type: 'object', required: ['id', 'status', 'total'],
    properties: { id: { type: 'string' }, status: { type: 'string' }, total: { type: 'number' }, note: { type: 'string' } } } } },
};
const ORDER = { id: 'o1', status: 'PENDING', total: 9.5, note: 'x' };

// --- the mock provider app: data + a published /openapi.json ---
function providerApp() {
  return new Promise((res) => {
    const s = http.createServer((req, r) => {
      r.writeHead(200, { 'content-type': 'application/json' });
      if (req.url === '/openapi.json') return r.end(JSON.stringify(SPEC));
      return r.end(JSON.stringify(ORDER));
    });
    s.listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port }));
  });
}

// --- two mock consumer apps that read different slices of the response ---
async function webConsumer(base) {           // reads the money field
  const o = await (await fetch(base + '/orders/o1')).json();
  return { id: o.id, status: o.status, total: o.total };
}
async function mobileConsumer(base) {         // never reads total
  const o = await (await fetch(base + '/orders/o1')).json();
  return { id: o.id, status: o.status };
}

const quiet = (fn) => { const o = console.log, e = console.error; console.log = () => {}; console.error = () => {}; try { return fn(); } finally { console.log = o; console.error = e; } };

test('provider->consumers->profiles->CLI: same change gates consumers differently', async () => {
  const { s, base } = await providerApp();

  // Provider publishes its spec; a client fetches it over the wire (before recording).
  const baseSpec = await (await fetch(base + '/openapi.json')).json();
  assert.strictEqual(baseSpec.info.title, 'orders');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-e2e-'));
  const webDir = path.join(dir, 'web');      // profiles for the web consumer only
  const mobileDir = path.join(dir, 'mobile'); // profiles for the mobile consumer only

  record.install(baseSpec);
  record.start({ provider: 'orders', specRef: 'orders@1' });
  await webConsumer(base);
  record.flush('web-app', { dir: webDir });

  record.start({ provider: 'orders', specRef: 'orders@1' });
  await mobileConsumer(base);
  record.flush('mobile-app', { dir: mobileDir });
  record.uninstall();
  s.close();

  // The provider proposes a breaking change: drop the (required) `total` field.
  const candidate = JSON.parse(JSON.stringify(baseSpec));
  delete candidate.components.schemas.Order.properties.total;
  candidate.components.schemas.Order.required = ['id', 'status'];

  const baseFile = path.join(dir, 'base.json');
  const candFile = path.join(dir, 'candidate.json');
  fs.writeFileSync(baseFile, JSON.stringify(baseSpec));
  fs.writeFileSync(candFile, JSON.stringify(candidate));

  // Library-level oracle: web breaks, mobile is safe.
  const webProfile = JSON.parse(fs.readFileSync(path.join(webDir, 'web-app.profile.json'), 'utf8'));
  const mobileProfile = JSON.parse(fs.readFileSync(path.join(mobileDir, 'mobile-app.profile.json'), 'utf8'));
  assert.strictEqual(isBreaking(baseSpec, candidate, webProfile).breaking, true);
  assert.strictEqual(isBreaking(baseSpec, candidate, mobileProfile).breaking, false);

  // Real CLI end-to-end: exit 1 for the web consumer, exit 0 for the mobile consumer.
  const webVerdict = quiet(() => main(['can-i-deploy', '--base', baseFile, '--candidate', candFile, '--profiles', webDir]));
  const mobileVerdict = quiet(() => main(['can-i-deploy', '--base', baseFile, '--candidate', candFile, '--profiles', mobileDir]));
  assert.strictEqual(webVerdict, 1, 'web consumer reads total -> breaking');
  assert.strictEqual(mobileVerdict, 0, 'mobile consumer never reads total -> safe');

  fs.rmSync(dir, { recursive: true, force: true });
});
