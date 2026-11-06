'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { usageReport, opRows, formatReport } = require('../src/report');
const { usageReport: usageReportFromIndex } = require('../src/index');
const { main } = require('../src/cli');

const web = { consumer: 'web-app', dependencies: [
  { op: 'GET /orders/{id}', kind: 'read', field: 'id' },
  { op: 'GET /orders/{id}', kind: 'read', field: 'total' },
  { op: 'GET /orders', kind: 'send', field: 'status' } ] };
const mobile = { consumer: 'mobile-app', dependencies: [
  { op: 'GET /orders/{id}', kind: 'read', field: 'id' },     // same field as web -> 2 consumers
  { op: 'GET /orders/{id}', kind: 'read', field: 'status' } ] };

test('aggregates consumers per operation/field', () => {
  const r = usageReport([web, mobile]);
  assert.strictEqual(r.total, 2);
  assert.deepStrictEqual(r.consumers, ['web-app', 'mobile-app']);
  const idEntry = r.ops['GET /orders/{id}']['read id'];
  assert.deepStrictEqual(idEntry.consumers.sort(), ['mobile-app', 'web-app']); // both read id
  const totalEntry = r.ops['GET /orders/{id}']['read total'];
  assert.deepStrictEqual(totalEntry.consumers, ['web-app']);                   // only web reads total
  assert.ok(r.ops['GET /orders']['send status']);
});

test('a consumer appearing twice for the same field is counted once', () => {
  const dup = { consumer: 'web-app', dependencies: [
    { op: 'GET /x', kind: 'read', field: 'a' },
    { op: 'GET /x', kind: 'read', field: 'a' } ] };
  const r = usageReport([dup]);
  assert.deepStrictEqual(r.ops['GET /x']['read a'].consumers, ['web-app']);
});

test('opRows sorts most-depended-on first', () => {
  const r = usageReport([web, mobile]);
  const rows = opRows(r.ops['GET /orders/{id}']);
  assert.strictEqual(rows[0].field, 'id');            // 2 consumers -> first
  assert.ok(rows[0].consumers.length >= rows[1].consumers.length);
});

test('formatReport renders a readable summary', () => {
  const text = formatReport(usageReport([web, mobile]));
  assert.match(text, /Usage report \(2 consumer\(s\)\):/);
  assert.match(text, /GET \/orders\/\{id\}/);
  assert.match(text, /read id\s+2\/2/);
});

test('empty input yields an empty report', () => {
  const r = usageReport([]);
  assert.deepStrictEqual(r, { total: 0, consumers: [], ops: {} });
});

test('re-exported from the index', () => {
  assert.strictEqual(usageReportFromIndex, usageReport);
});

const quiet = (fn) => { const o = console.log, e = console.error; console.log = () => {}; console.error = () => {}; try { return fn(); } finally { console.log = o; console.error = e; } };

test('CLI usage-report: text, --json, and error paths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-report-'));
  const profDir = path.join(dir, 'profiles'); fs.mkdirSync(profDir);
  fs.writeFileSync(path.join(profDir, 'web-app.profile.json'), JSON.stringify(web));
  fs.writeFileSync(path.join(profDir, 'mobile-app.profile.json'), JSON.stringify(mobile));
  assert.strictEqual(quiet(() => main(['usage-report', '--profiles', profDir])), 0);
  assert.strictEqual(quiet(() => main(['usage-report', '--profiles', profDir, '--json'])), 0);
  assert.strictEqual(quiet(() => main(['usage-report'])), 2);                         // missing --profiles
  assert.strictEqual(quiet(() => main(['usage-report', '--profiles', path.join(dir, 'nope')])), 2); // empty
  fs.rmSync(dir, { recursive: true, force: true });
});
