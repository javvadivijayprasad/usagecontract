'use strict';
const test = require('node:test'); const assert = require('node:assert');
const { compat, isBreaking } = require('../src/compat');
const base = { openapi: '3.0.0', info: { title: 't', version: '1' }, paths: { 'GET-x': {} },
  components: { schemas: { O: { type: 'object', required: ['a', 'b'], properties: { a: { type: 'string' }, b: { type: 'number' }, c: { type: 'string' } } } } } };
base.paths = { '/o/{id}': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/O' } } } } } } } };
const P = { consumer: 'c', dependencies: [{ op: 'GET /o/{id}', kind: 'read', field: 'a', type: 'string' }, { op: 'GET /o/{id}', kind: 'read', field: 'b', type: 'number' }] };
const clone = x => JSON.parse(JSON.stringify(x));

test('base is compatible', () => assert.strictEqual(compat(base, P).compatible, true));
test('removing a used field breaks', () => { const s = clone(base); delete s.components.schemas.O.properties.a; assert.strictEqual(isBreaking(base, s, P).breaking, true); });
test('removing an unused field is safe', () => { const s = clone(base); delete s.components.schemas.O.properties.c; assert.strictEqual(isBreaking(base, s, P).breaking, false); });
test('type change on used field breaks', () => { const s = clone(base); s.components.schemas.O.properties.b = { type: 'string' }; assert.strictEqual(isBreaking(base, s, P).breaking, true); });
test('making a used field optional breaks', () => { const s = clone(base); s.components.schemas.O.required = ['b']; assert.strictEqual(isBreaking(base, s, P).breaking, true); });
