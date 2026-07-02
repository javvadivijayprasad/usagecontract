'use strict';
const test = require('node:test'); const assert = require('node:assert');
const { isBreaking } = require('../src/compat');
const clone = (x) => JSON.parse(JSON.stringify(x));
const base = {
  paths: {
    '/o/{id}': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/O' } } } } } } },
    '/list': { get: { parameters: [], responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/O' } } } } } } },
  },
  components: { schemas: { O: { type: 'object', required: ['id', 'n'], properties: { id: { type: 'string' }, n: { type: 'number' }, x: { type: 'string' } } } } },
};
const P = { consumer: 'c', dependencies: [{ op: 'GET /o/{id}', kind: 'read', field: 'id', type: 'string' }, { op: 'GET /o/{id}', kind: 'read', field: 'n', type: 'number' }] };

test('removing the whole operation is breaking', () => {
  const s = clone(base); delete s.paths['/o/{id}'].get;
  assert.strictEqual(isBreaking(base, s, P).breaking, true);
});
test('integer is an acceptable number (not breaking)', () => {
  const s = clone(base); s.components.schemas.O.properties.n = { type: 'integer' };
  assert.strictEqual(isBreaking(base, s, P).breaking, false);
});
test('number is NOT an acceptable integer (breaking)', () => {
  const b = clone(base); b.components.schemas.O.properties.n = { type: 'integer' };   // baseline: integer
  const intP = { consumer: 'c', dependencies: [{ op: 'GET /o/{id}', kind: 'read', field: 'n', type: 'integer' }] };
  const s = clone(b); s.components.schemas.O.properties.n = { type: 'number' };        // widened to number
  assert.strictEqual(isBreaking(b, s, intP).breaking, true);
});
test('newly-required query param breaks a caller not sending it', () => {
  const listP = { consumer: 'c', dependencies: [{ op: 'GET /list', kind: 'read', field: 'id', type: 'string' }] };
  const s = clone(base); s.paths['/list'].get.parameters = [{ name: 'tenant', in: 'query', required: true, schema: { type: 'string' } }];
  assert.strictEqual(isBreaking(base, s, listP).breaking, true);
});
test('pre-existing required param is NOT a false break', () => {
  const withReq = clone(base); withReq.paths['/list'].get.parameters = [{ name: 'tenant', in: 'query', required: true, schema: { type: 'string' } }];
  const listP = { consumer: 'c', dependencies: [{ op: 'GET /list', kind: 'read', field: 'id', type: 'string' }] };
  assert.strictEqual(isBreaking(withReq, withReq, listP).breaking, false);
});
test('additive (new optional field) is safe', () => {
  const s = clone(base); s.components.schemas.O.properties.newf = { type: 'string' };
  assert.strictEqual(isBreaking(base, s, P).breaking, false);
});
