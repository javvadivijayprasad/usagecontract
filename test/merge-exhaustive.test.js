'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const recorder = require('../src/recorder');
const { isBreaking } = require('../src/compat');
const { record, registry } = require('../src/index');

const spec = { paths: { '/o/{id}': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/O' } } } } } } } },
  components: { schemas: { O: { type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['A', 'B'] } } } } } };
const widen = () => { const s = JSON.parse(JSON.stringify(spec)); s.components.schemas.O.properties.status.enum.push('C'); return s; };

test('exhaustive annotation: dep gets enum + exhaustive from the spec', () => {
  recorder.configure(spec);
  recorder.startConsumer({ provider: 'o', specRef: 'o@1', exhaustive: [{ op: 'GET /o/{id}', field: 'status' }] });
  void recorder.wrap({ status: 'A' }, '', 'GET /o/{id}').status;
  const p = recorder.stopConsumer('c');
  const dep = p.dependencies.find(d => d.field === 'status');
  assert.strictEqual(dep.exhaustive, true);
  assert.deepStrictEqual(dep.enum, ['A', 'B']);
});

test('exhaustive consumer: widening the enum is BREAKING', () => {
  recorder.configure(spec);
  recorder.startConsumer({ provider: 'o', specRef: 'o@1', exhaustive: [{ op: 'GET /o/{id}', field: 'status' }] });
  void recorder.wrap({ status: 'A' }, '', 'GET /o/{id}').status;
  const p = recorder.stopConsumer('c');
  assert.strictEqual(isBreaking(spec, widen(), p).breaking, true);
});

test('non-exhaustive consumer: widening the enum is SAFE', () => {
  recorder.configure(spec);
  recorder.startConsumer({ provider: 'o', specRef: 'o@1' });
  void recorder.wrap({ status: 'A' }, '', 'GET /o/{id}').status;
  const p = recorder.stopConsumer('c2');
  assert.strictEqual(isBreaking(spec, widen(), p).breaking, false);
});

test('mergeProfiles unions dependencies from two runs', () => {
  const a = { consumer: 'web', provider: 'o', specRef: 'o@1', dependencies: [{ op: 'GET /o', kind: 'read', field: 'a' }] };
  const b = { consumer: 'web', provider: 'o', specRef: 'o@1', dependencies: [{ op: 'GET /o', kind: 'read', field: 'b' }] };
  const m = record.merge(a, b);
  assert.deepStrictEqual(m.dependencies.map(d => d.field).sort(), ['a', 'b']);
});

test('flush({merge:true}) accumulates across runs on disk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-merge-'));
  registry.saveProfile(dir, { consumer: 'web', provider: 'o', specRef: 'o@1', dependencies: [{ op: 'GET /x', kind: 'read', field: 'a' }] });
  recorder.configure({ paths: {} });
  recorder.startConsumer({ provider: 'o', specRef: 'o@1' });
  void recorder.wrap({ b: 1 }, '', 'GET /x').b;
  record.flush('web', { dir, merge: true });
  const merged = registry.loadProfile(dir, 'web');
  assert.deepStrictEqual(merged.dependencies.map(d => d.field).sort(), ['a', 'b']);
});
