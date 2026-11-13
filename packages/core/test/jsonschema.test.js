'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { profileToJsonSchema } = require('../src/index');
const { main } = require('../src/cli');

const profile = {
  consumer: 'web-app', provider: 'orders', specRef: 'orders@1',
  dependencies: [
    { op: 'GET /orders/{id}', kind: 'read', field: 'id', type: 'string' },
    { op: 'GET /orders/{id}', kind: 'read', field: 'items[].sku', type: 'string' },
    { op: 'GET /orders/{id}', kind: 'read', field: 'items[].qty', type: 'integer' },
    { op: 'GET /orders/{id}', kind: 'read', field: 'status', type: 'string', enum: ['PENDING', 'SHIPPED'] },
    { op: 'GET /orders/{id}', kind: 'send', field: 'verbose' }, // send deps are ignored
    { op: 'GET /orders', kind: 'read', field: 'data[].id', type: 'string' },
  ],
};

test('groups schemas by operation and ignores send deps', () => {
  const out = profileToJsonSchema(profile);
  assert.deepStrictEqual(Object.keys(out).sort(), ['GET /orders', 'GET /orders/{id}']);
});

test('rebuilds nested object + array structure from dot/bracket paths', () => {
  const s = profileToJsonSchema(profile)['GET /orders/{id}'];
  assert.strictEqual(s.$schema, 'http://json-schema.org/draft-07/schema#');
  assert.strictEqual(s.type, 'object');
  assert.strictEqual(s.properties.id.type, 'string');
  // items[] -> array of objects with sku + qty
  assert.strictEqual(s.properties.items.type, 'array');
  assert.strictEqual(s.properties.items.items.type, 'object');
  assert.strictEqual(s.properties.items.items.properties.sku.type, 'string');
  assert.strictEqual(s.properties.items.items.properties.qty.type, 'integer');
  assert.deepStrictEqual(s.properties.items.items.required.sort(), ['qty', 'sku']);
});

test('carries enum onto leaf schemas', () => {
  const s = profileToJsonSchema(profile)['GET /orders/{id}'];
  assert.deepStrictEqual(s.properties.status.enum, ['PENDING', 'SHIPPED']);
});

test('top-level required lists the consumed fields', () => {
  const s = profileToJsonSchema(profile)['GET /orders/{id}'];
  assert.deepStrictEqual(s.required.sort(), ['id', 'items', 'status']);
});

test('nested array of scalars', () => {
  const out = profileToJsonSchema({ consumer: 'c', dependencies: [
    { op: 'GET /x', kind: 'read', field: 'tags[]', type: 'string' } ] });
  assert.strictEqual(out['GET /x'].properties.tags.type, 'array');
  assert.strictEqual(out['GET /x'].properties.tags.items.type, 'string');
});

test('empty / missing dependencies yields empty object', () => {
  assert.deepStrictEqual(profileToJsonSchema({ consumer: 'c' }), {});
  assert.deepStrictEqual(profileToJsonSchema({}), {});
});

test('a field read both as leaf and as a parent promotes to object', () => {
  const out = profileToJsonSchema({ consumer: 'c', dependencies: [
    { op: 'GET /x', kind: 'read', field: 'meta', type: 'string' },
    { op: 'GET /x', kind: 'read', field: 'meta.tag', type: 'string' } ] });
  assert.strictEqual(out['GET /x'].properties.meta.type, 'object');
  assert.strictEqual(out['GET /x'].properties.meta.properties.tag.type, 'string');
});

const quiet = (fn) => { const o = console.log, e = console.error; console.log = () => {}; console.error = () => {}; try { return fn(); } finally { console.log = o; console.error = e; } };

test('CLI export-schema writes one file per consumer', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-schema-'));
  const profDir = path.join(dir, 'profiles'); fs.mkdirSync(profDir);
  fs.writeFileSync(path.join(profDir, 'web-app.profile.json'), JSON.stringify(profile));
  const out = path.join(dir, 'schemas');
  const code = quiet(() => main(['export-schema', '--profiles', profDir, '--out', out]));
  assert.strictEqual(code, 0);
  const written = JSON.parse(fs.readFileSync(path.join(out, 'web-app.schema.json'), 'utf8'));
  assert.strictEqual(written['GET /orders/{id}'].properties.id.type, 'string');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('CLI export-schema prints to stdout (--json) and errors without --profiles', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-schema-'));
  const profDir = path.join(dir, 'profiles'); fs.mkdirSync(profDir);
  fs.writeFileSync(path.join(profDir, 'web-app.profile.json'), JSON.stringify(profile));
  assert.strictEqual(quiet(() => main(['export-schema', '--profiles', profDir, '--json'])), 0);
  assert.strictEqual(quiet(() => main(['export-schema', '--profiles', profDir])), 0);
  assert.strictEqual(quiet(() => main(['export-schema'])), 2);            // missing --profiles
  assert.strictEqual(quiet(() => main(['export-schema', '--profiles', path.join(dir, 'nope')])), 2); // empty
  fs.rmSync(dir, { recursive: true, force: true });
});
