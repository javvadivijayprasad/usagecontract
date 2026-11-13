'use strict';
const test = require('node:test'); const assert = require('node:assert');
const recorder = require('../src/recorder');

function fieldsOf(p) { return p.dependencies.filter(d => d.kind === 'read').map(d => d.field).sort(); }

test('records nested object, array-of-object, and array-of-scalar reads', () => {
  recorder.startConsumer();
  const o = recorder.wrap({ a: { b: 'x' }, items: [{ sku: 's' }], tags: ['t1', 't2'] }, '', 'GET /x');
  void o.a.b; o.items.map(i => i.sku); for (const t of o.tags) void t;
  assert.deepStrictEqual(fieldsOf(recorder.stopConsumer('c')), ['a.b', 'items[].sku', 'tags[]']);
});

test('does NOT record fields that are never read', () => {
  recorder.startConsumer();
  const o = recorder.wrap({ used: 1, unused: 2 }, '', 'GET /x');
  void o.used;
  assert.deepStrictEqual(fieldsOf(recorder.stopConsumer('c')), ['used']);
});

test('infers scalar types', () => {
  recorder.startConsumer();
  const o = recorder.wrap({ s: 'x', i: 3, f: 1.5, b: true }, '', 'GET /x');
  void o.s; void o.i; void o.f; void o.b;
  const byField = Object.fromEntries(recorder.stopConsumer('c').dependencies.map(d => [d.field, d.type]));
  assert.strictEqual(byField.s, 'string');
  assert.strictEqual(byField.i, 'integer');
  assert.strictEqual(byField.f, 'number');
  assert.strictEqual(byField.b, 'boolean');
});

test('startConsumer resets state between consumers', () => {
  recorder.startConsumer();
  void recorder.wrap({ a: 1 }, '', 'GET /x').a;
  recorder.stopConsumer('c1');
  recorder.startConsumer();
  void recorder.wrap({ b: 1 }, '', 'GET /x').b;
  assert.deepStrictEqual(fieldsOf(recorder.stopConsumer('c2')), ['b']);
});
