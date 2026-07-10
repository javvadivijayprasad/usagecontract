'use strict';
// Real integration tests for the got and undici adapters, over a live HTTP server.
const test = require('node:test'); const assert = require('node:assert');
const http = require('http');
const { record } = require('../src/index');
const undici = require('undici');
const got = require('got');

const spec = {
  openapi: '3.0.0', info: { title: 'orders', version: '1' },
  paths: { '/orders/{id}': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } } } } } },
  components: { schemas: { Order: { type: 'object', required: ['id', 'status', 'total'], properties: { id: { type: 'string' }, status: { type: 'string' }, total: { type: 'number' }, note: { type: 'string' } } } } },
};
const DATA = { id: 'o1', status: 'PENDING', total: 9.5, note: 'x' };
function server() { return new Promise((res) => { const s = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify(DATA)); }); s.listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port })); }); }
const fields = (p) => p.dependencies.filter(d => d.kind === 'read').map(d => d.field).sort();

test('undici adapter records only read fields', async () => {
  const { s, base } = await server();
  const request = record.installUndici(undici, spec);
  record.start({ provider: 'orders', specRef: 'orders@1' });
  const { body } = await request(base + '/orders/o1');
  const data = await body.json();
  void data.status; void data.total;               // read two; ignore id, note
  const p = record.stop('undici-consumer'); s.close();
  assert.deepStrictEqual(fields(p), ['status', 'total']);
});

test('got adapter records only read fields', async () => {
  const { s, base } = await server();
  const client = record.installGot(got, spec);
  record.start({ provider: 'orders', specRef: 'orders@1' });
  const resp = await client(base + '/orders/o1', { responseType: 'json' });
  void resp.body.status; void resp.body.total;      // read two; ignore id, note
  const p = record.stop('got-consumer'); s.close();
  assert.deepStrictEqual(fields(p), ['status', 'total']);
});
