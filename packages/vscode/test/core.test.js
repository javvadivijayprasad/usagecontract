'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const core = require('../src/core');

const BASE = {
  openapi: '3.0.0', info: { title: 'orders', version: '1' },
  paths: { '/orders/{id}': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } } } } } },
  components: { schemas: { Order: { type: 'object', required: ['id', 'status', 'total'],
    properties: { id: { type: 'string' }, status: { type: 'string' }, total: { type: 'number' }, note: { type: 'string' } } } } },
};
function candidateDroppingTotal() {
  const c = JSON.parse(JSON.stringify(BASE));
  delete c.components.schemas.Order.properties.total;
  c.components.schemas.Order.required = ['id', 'status'];
  return c;
}
const webProfile = { consumer: 'web-app', provider: 'orders', specRef: 'orders@1', dependencies: [
  { op: 'GET /orders/{id}', kind: 'read', field: 'id', type: 'string' },
  { op: 'GET /orders/{id}', kind: 'read', field: 'total', type: 'number' } ] };
const mobileProfile = { consumer: 'mobile-app', provider: 'orders', specRef: 'orders@1', dependencies: [
  { op: 'GET /orders/{id}', kind: 'read', field: 'id', type: 'string' },
  { op: 'GET /orders/{id}', kind: 'read', field: 'status', type: 'string' } ] };

test('gate: same change breaks web (reads total) but not mobile', () => {
  const res = core.gate(BASE, candidateDroppingTotal(), [webProfile, mobileProfile]);
  assert.strictEqual(res.ok, false);
  assert.deepStrictEqual(res.breakingConsumers, ['web-app']);
  assert.strictEqual(res.results.find((r) => r.consumer === 'mobile-app').breaking, false);
});

test('gate: identical spec is safe for all', () => {
  const res = core.gate(BASE, JSON.parse(JSON.stringify(BASE)), [webProfile, mobileProfile]);
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.breakingConsumers, []);
});

test('coverageReport: per-consumer pct/read/reachable', () => {
  const rep = core.coverageReport(BASE, [webProfile]);
  assert.strictEqual(rep[0].consumer, 'web-app');
  assert.ok(typeof rep[0].pct === 'number');
  assert.ok(typeof rep[0].read === 'number' && typeof rep[0].reachable === 'number');
});

test('offsetToPos: maps offsets to line/character', () => {
  const text = 'a\nbc\ndef';
  assert.deepStrictEqual(core.offsetToPos(text, 0), { line: 0, character: 0 });
  assert.deepStrictEqual(core.offsetToPos(text, 2), { line: 1, character: 0 });
  assert.deepStrictEqual(core.offsetToPos(text, 5), { line: 2, character: 0 });
  assert.deepStrictEqual(core.offsetToPos(text, 100), { line: 2, character: 95 }); // clamps to text length (8)
});

test('locate: finds a field, falls back to op path, then to 0,0', () => {
  const text = '{\n  "total": { "type": "number" },\n  "paths": { "/orders/{id}": {} }\n}';
  const atField = core.locate(text, { field: 'items[].total', op: 'GET /orders/{id}' });
  assert.strictEqual(atField.line, 1); // "total" is on line index 1
  const atOp = core.locate(text, { op: 'GET /orders/{id}' });
  assert.strictEqual(atOp.line, 2); // path string appears on line index 2
  assert.deepStrictEqual(core.locate('{}', { field: 'nope', op: 'GET /absent' }), { line: 0, character: 0 });
});

test('diagnostics: one entry per breaking violation, with a message and location', () => {
  const cand = candidateDroppingTotal();
  const text = JSON.stringify(cand, null, 2);
  const diags = core.diagnostics(BASE, cand, text, [webProfile, mobileProfile]);
  assert.strictEqual(diags.length, 1); // only web-app breaks, one violation
  assert.strictEqual(diags[0].consumer, 'web-app');
  assert.match(diags[0].message, /Breaking for web-app/);
  assert.ok(diags[0].line >= 0 && diags[0].character >= 0);
});

test('diagnostics: empty when nothing breaks', () => {
  const text = JSON.stringify(BASE, null, 2);
  assert.deepStrictEqual(core.diagnostics(BASE, JSON.parse(JSON.stringify(BASE)), text, [webProfile]), []);
});

test('loadJson + loadProfiles read from disk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-vsx-'));
  const specFile = path.join(dir, 'base.json');
  fs.writeFileSync(specFile, JSON.stringify(BASE));
  const profDir = path.join(dir, 'profiles');
  fs.mkdirSync(profDir);
  fs.writeFileSync(path.join(profDir, 'web-app.profile.json'), JSON.stringify(webProfile));
  const loaded = core.loadJson(specFile);
  assert.strictEqual(loaded.info.title, 'orders');
  const profs = core.loadProfiles(profDir);
  assert.strictEqual(profs.length, 1);
  assert.strictEqual(profs[0].consumer, 'web-app');
  fs.rmSync(dir, { recursive: true, force: true });
});
