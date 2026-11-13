'use strict';
const test = require('node:test'); const assert = require('node:assert');
const { coverage } = require('../src/coverage');
const spec = { paths: { '/orders/{id}': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } } } } } },
  components: { schemas: { Order: { type: 'object', properties: {
    id: { type: 'string' }, status: { type: 'string' }, total: { type: 'number' }, currency: { type: 'string' },
    items: { type: 'array', items: { type: 'object', properties: { sku: { type: 'string' }, qty: { type: 'integer' } } } } } } } } };
const profile = { consumer: 'web-app', dependencies: [
  { op: 'GET /orders/{id}', kind: 'read', field: 'status' },
  { op: 'GET /orders/{id}', kind: 'read', field: 'total' },
  { op: 'GET /orders/{id}', kind: 'read', field: 'items[].sku' } ] };

test('coverage counts read vs reachable leaves', () => {
  const c = coverage(spec, profile);
  assert.strictEqual(c.read, 3);
  assert.strictEqual(c.reachable, 6);        // id,status,total,currency,items[].sku,items[].qty
  assert.strictEqual(Math.round(c.pct * 100), 50);
});
test('coverage lists unread fields', () => {
  const c = coverage(spec, profile);
  assert.deepStrictEqual(c.perOp['GET /orders/{id}'].unread, ['currency', 'id', 'items[].qty']);
});
