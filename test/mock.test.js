'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const mock = require('../src/mock');
const { main } = require('../src/cli');

const profile = {
  consumer: 'web-app', provider: 'orders', specRef: 'orders@1',
  dependencies: [
    { op: 'GET /orders/{id}', kind: 'read', field: 'id', type: 'string' },
    { op: 'GET /orders/{id}', kind: 'read', field: 'status', type: 'string', enum: ['PENDING', 'SHIPPED'] },
    { op: 'GET /orders/{id}', kind: 'read', field: 'items[].sku', type: 'string' },
    { op: 'GET /orders/{id}', kind: 'read', field: 'items[].qty', type: 'integer' },
  ],
};
const mobile = {
  consumer: 'mobile-app', provider: 'orders', specRef: 'orders@1',
  dependencies: [
    { op: 'GET /orders/{id}', kind: 'read', field: 'total', type: 'number' }, // different field, same op
    { op: 'GET /orders', kind: 'read', field: 'data[].id', type: 'string' },
  ],
};

test('fakeFromSchema produces schema-valid values', () => {
  assert.strictEqual(mock.fakeFromSchema({ type: 'string' }), 'string');
  assert.strictEqual(mock.fakeFromSchema({ type: 'integer' }), 1);
  assert.strictEqual(mock.fakeFromSchema({ type: 'number' }), 1.5);
  assert.strictEqual(mock.fakeFromSchema({ type: 'boolean' }), true);
  assert.strictEqual(mock.fakeFromSchema({ type: 'weird' }), null);
  assert.strictEqual(mock.fakeFromSchema(null), null);
  assert.strictEqual(mock.fakeFromSchema({ enum: ['A', 'B'] }), 'A');
  assert.deepStrictEqual(mock.fakeFromSchema({ type: 'array', items: { type: 'string' } }), ['string']);
  assert.deepStrictEqual(mock.fakeFromSchema({ type: 'array' }), [null]);
  assert.deepStrictEqual(mock.fakeFromSchema({ type: 'object', properties: { a: { type: 'string' } } }), { a: 'string' });
});

test('mergeSchema unions properties, required, and array items', () => {
  const a = { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] };
  const b = { type: 'object', properties: { total: { type: 'number' } }, required: ['total'] };
  const m = mock.mergeSchema(a, b);
  assert.deepStrictEqual(Object.keys(m.properties).sort(), ['id', 'total']);
  assert.deepStrictEqual(m.required.sort(), ['id', 'total']);
  assert.strictEqual(mock.mergeSchema(null, b), b);
  assert.strictEqual(mock.mergeSchema(a, null), a);
  const arr = mock.mergeSchema({ type: 'array', items: { type: 'object', properties: { a: { type: 'string' } } } },
                               { type: 'array', items: { type: 'object', properties: { b: { type: 'string' } } } });
  assert.deepStrictEqual(Object.keys(arr.items.properties).sort(), ['a', 'b']);
});

test('responsesFor merges the same op across consumers', () => {
  const byOp = mock.responsesFor([profile, mobile]);
  assert.deepStrictEqual(Object.keys(byOp).sort(), ['GET /orders', 'GET /orders/{id}']);
  const props = Object.keys(byOp['GET /orders/{id}'].properties).sort();
  assert.deepStrictEqual(props, ['id', 'items', 'status', 'total']); // union of web + mobile
});

test('mock server answers matched operations with valid fake data, 404 otherwise', async () => {
  const server = mock.createMockServer([profile, mobile]);
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const base = 'http://127.0.0.1:' + server.address().port;

  const r = await fetch(base + '/orders/o1');
  assert.strictEqual(r.status, 200);
  const body = await r.json();
  assert.strictEqual(typeof body.id, 'string');
  assert.strictEqual(body.status, 'PENDING');          // enum -> first value
  assert.strictEqual(typeof body.total, 'number');
  assert.ok(Array.isArray(body.items));
  assert.strictEqual(typeof body.items[0].sku, 'string');
  assert.strictEqual(typeof body.items[0].qty, 'number');

  const list = await (await fetch(base + '/orders')).json();
  assert.ok(Array.isArray(list.data) && typeof list.data[0].id === 'string');

  const miss = await fetch(base + '/unknown');
  assert.strictEqual(miss.status, 404);

  await new Promise((res) => server.close(res));
});

const quiet = (fn) => { const o = console.log, e = console.error; console.log = () => {}; console.error = () => {}; try { return fn(); } finally { console.log = o; console.error = e; } };

test('CLI mock starts a server (and errors without profiles)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-mock-'));
  const profDir = path.join(dir, 'profiles'); fs.mkdirSync(profDir);
  fs.writeFileSync(path.join(profDir, 'web-app.profile.json'), JSON.stringify(profile));

  assert.strictEqual(quiet(() => main(['mock'])), 2);                                   // missing --profiles
  assert.strictEqual(quiet(() => main(['mock', '--profiles', path.join(dir, 'nope')])), 2); // empty

  const code = quiet(() => main(['mock', '--profiles', profDir, '--port', '0']));
  assert.strictEqual(code, 0);
  const server = mock._lastServer();
  assert.ok(server);
  await new Promise((res) => server.close(res));                                         // release the handle
  fs.rmSync(dir, { recursive: true, force: true });
});
