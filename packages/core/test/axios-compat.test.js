'use strict';
// axios v0.x vs v1.x compatibility. The interceptor API is stable across versions, but
// the `params` shape is not: v0.x passes a plain object, v1.x commonly a URLSearchParams.
// These tests drive installAxios with both shapes (via a minimal mock that mimics the
// axios interceptor pipeline) and then confirm the same behavior against the real axios.
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
const sends = (p) => p.dependencies.filter(d => d.kind === 'send').map(d => d.field).sort();
const reads = (p) => p.dependencies.filter(d => d.kind === 'read').map(d => d.field).sort();

// Minimal stand-in for an axios instance: exposes interceptors and replays them, exactly
// as both axios 0.x and 1.x do (config -> request interceptors -> response interceptors).
function mockAxios() {
  const req = [], res = [];
  return {
    interceptors: {
      request: { use: (f) => req.push(f) },
      response: { use: (f) => res.push(f) },
    },
    async request(cfg, data) {
      let c = cfg; for (const f of req) c = f(c);
      let r = { config: c, data }; for (const f of res) r = f(r);
      return r;
    },
  };
}

test('axios v0.x shape: params as a plain object', async () => {
  const ax = mockAxios();
  record.installAxios(ax, spec);
  record.start({ provider: 'orders', specRef: 'orders@1' });
  const r = await ax.request({ method: 'get', baseURL: 'http://api', url: '/orders', params: { status: 'PENDING' } }, { data: [ORDER] });
  for (const d of r.data.data) void d.id;
  const p = record.stop('axios0-consumer');
  assert.deepStrictEqual(sends(p), ['status']);
  assert.ok(reads(p).includes('data[].id'));
});

test('axios v1.x shape: params as a URLSearchParams', async () => {
  const ax = mockAxios();
  record.installAxios(ax, spec);
  record.start({ provider: 'orders', specRef: 'orders@1' });
  const r = await ax.request({ method: 'get', baseURL: 'http://api', url: '/orders', params: new URLSearchParams({ status: 'PENDING' }) }, { data: [ORDER] });
  for (const d of r.data.data) void d.id;
  const p = record.stop('axios1-consumer');
  assert.deepStrictEqual(sends(p), ['status'], 'URLSearchParams params must still be recorded');
  assert.ok(reads(p).includes('data[].id'));
});

test('real axios: URLSearchParams params recorded over the network', async () => {
  const s = http.createServer((req, r) => { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify({ data: [ORDER, ORDER] })); });
  await new Promise((res) => s.listen(0, '127.0.0.1', res));
  const base = 'http://127.0.0.1:' + s.address().port;
  const ax = axios.create({ baseURL: base });
  record.installAxios(ax, spec);
  record.start({ provider: 'orders', specRef: 'orders@1' });
  const resp = await ax.get('/orders', { params: new URLSearchParams({ status: 'PENDING' }) });
  for (const d of resp.data.data) void d.id;
  const p = record.stop('axios-real-consumer'); s.close();
  assert.deepStrictEqual(sends(p), ['status']);
  assert.ok(reads(p).includes('data[].id'));
});
