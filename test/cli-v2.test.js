'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { main } = require('../src/cli');

const clone = (x) => JSON.parse(JSON.stringify(x));
const base = { openapi: '3.0.0', info: { title: 'orders', version: '1.0.0' },
  paths: { '/orders/{id}': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/O' } } } } } } } },
  components: { schemas: { O: { type: 'object', required: ['id', 'total'], properties: { id: { type: 'string' }, total: { type: 'number' }, x: { type: 'string' } } } } } };

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-cli2-'));
  const reg = path.join(dir, 'registry'); const prof = path.join(dir, 'profiles');
  fs.mkdirSync(prof, { recursive: true });
  fs.writeFileSync(path.join(prof, 'web-app.profile.json'), JSON.stringify({ consumer: 'web-app', provider: 'orders', specRef: 'orders@1.0.0',
    dependencies: [{ op: 'GET /orders/{id}', kind: 'read', field: 'id', type: 'string' }, { op: 'GET /orders/{id}', kind: 'read', field: 'total', type: 'number' }] }));
  // store baseline spec in the registry
  fs.mkdirSync(path.join(reg, 'specs'), { recursive: true });
  fs.writeFileSync(path.join(reg, 'specs', 'orders@1.0.0.json'), JSON.stringify(base));
  // candidates
  const nextBreak = clone(base); nextBreak.components.schemas.O.properties.amount = nextBreak.components.schemas.O.properties.total; delete nextBreak.components.schemas.O.properties.total;
  fs.writeFileSync(path.join(dir, 'break.json'), JSON.stringify(nextBreak));
  fs.writeFileSync(path.join(dir, 'same.json'), JSON.stringify(base));
  return { dir, reg, prof };
}
function capture(fn) { const out = []; const o = console.log; console.log = (s) => out.push(s); const e = console.error; console.error = () => {}; try { const code = fn(); return { code, out: out.join('\n') }; } finally { console.log = o; console.error = e; } }

test('registry-resolved can-i-deploy: breaking candidate -> exit 1', () => {
  const { reg, prof, dir } = setup();
  const { code } = capture(() => main(['can-i-deploy', '--registry', reg, '--candidate', path.join(dir, 'break.json'), '--profiles', prof]));
  assert.strictEqual(code, 1);
});
test('registry-resolved can-i-deploy: same spec -> exit 0', () => {
  const { reg, prof, dir } = setup();
  const { code } = capture(() => main(['can-i-deploy', '--registry', reg, '--candidate', path.join(dir, 'same.json'), '--profiles', prof]));
  assert.strictEqual(code, 0);
});
test('--json emits a parseable verdict', () => {
  const { reg, prof, dir } = setup();
  const { out } = capture(() => main(['can-i-deploy', '--registry', reg, '--candidate', path.join(dir, 'break.json'), '--profiles', prof, '--json']));
  const j = JSON.parse(out);
  assert.strictEqual(j.verdict, 'BREAKING');
  assert.strictEqual(j.affected[0].consumer, 'web-app');
});
test('push stores a spec and profiles; returns 0', () => {
  const { reg, prof, dir } = setup();
  const { code } = capture(() => main(['push', '--registry', path.join(dir, 'reg2'), '--spec', path.join(dir, 'same.json'), '--ref', 'orders@1.0.0', '--profiles', prof]));
  assert.strictEqual(code, 0);
});
