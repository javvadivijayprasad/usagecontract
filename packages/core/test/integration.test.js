'use strict';
// REAL integration test: a real HTTP server + real HTTP clients (global fetch and
// the real axios package) over the loopback network. Verifies the recorder captures
// exactly the fields each client reads, and the query params it sends.
const test = require('node:test'); const assert = require('node:assert');
const http = require('http');
const { record } = require('../src/index');
const axios = require('axios');

const spec = {
  openapi: '3.0.0', info: { title: 'orders', version: '1' },
  paths: {
    '/orders/{id}': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } } } } },
    '/orders': { get: { parameters: [{ name: 'status', in: 'query' }], responses: { '200': { content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/Order' } } } } } } } } } },
  },
  components: { schemas: { Order: { type: 'object', required: ['id', 'status', 'total'], properties: { id: { type: 'string' }, status: { type: 'string' }, total: { type: 'number' }, note: { type: 'string' } } } } },
};
const ORDER = { id: 'o1', status: 'PENDING', total: 9.5, note: 'x' };

function server() { return new Promise((res) => { const s = http.createServer((req, r) => { r.writeHead(200, { 'content-type': 'application/json' });
  if (req.url.startsWith('/orders/')) r.end(JSON.stringify(ORDER));
  else r.end(JSON.stringify({ data: [ORDER, ORDER] })); });
  s.listen(0, '127.0.0.1', () => res({ s, base: 'http://127.0.0.1:' + s.address().port })); }); }

function fields(p) { return p.dependencies.filter(d => d.kind === 'read').map(d => d.field).sort(); }
function sends(p) { return p.dependencies.filter(d => d.kind === 'send').map(d => d.field).sort(); }

test('global fetch: records only read fields, over real network', async () => {
  const { s, base } = await server();
  record.install(spec); record.start({ provider: 'orders', specRef: 'orders@1' });
  const o = await (await fetch(base + '/orders/o1')).json();
  void o.status; void o.total;                 // read two fields; ignore id, note
  const p = record.stop('fetch-consumer'); record.uninstall(); s.close();
  assert.deepStrictEqual(fields(p), ['status', 'total']);
});

test('real axios: records read fields and sent query params', async () => {
  const { s, base } = await server();
  const ax = axios.create({ baseURL: base });
  record.installAxios(ax, spec); record.start({ provider: 'orders', specRef: 'orders@1' });
  const r1 = await ax.get('/orders/o1');
  void r1.data.status; void r1.data.total;     // reads
  const r2 = await ax.get('/orders', { params: { status: 'PENDING' } });
  for (const d of r2.data.data) void d.id;      // read data[].id, send status
  const p = record.stop('axios-consumer'); s.close();
  assert.ok(fields(p).includes('status') && fields(p).includes('total') && fields(p).includes('data[].id'));
  assert.deepStrictEqual(sends(p), ['status']);
});
