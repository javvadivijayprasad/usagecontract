'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { main } = require('../src/cli');

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-cli-'));
  const spec = { paths: { '/o/{id}': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/O' } } } } } } } },
    components: { schemas: { O: { type: 'object', required: ['id', 'total'], properties: { id: { type: 'string' }, total: { type: 'number' }, x: { type: 'string' } } } } } };
  fs.writeFileSync(path.join(dir, 'base.json'), JSON.stringify(spec));
  const next = JSON.parse(JSON.stringify(spec)); next.components.schemas.O.properties.amount = next.components.schemas.O.properties.total; delete next.components.schemas.O.properties.total;
  fs.writeFileSync(path.join(dir, 'next.json'), JSON.stringify(next));
  fs.mkdirSync(path.join(dir, 'profiles'));
  fs.writeFileSync(path.join(dir, 'profiles', 'web-app.profile.json'), JSON.stringify({ consumer: 'web-app', dependencies: [
    { op: 'GET /o/{id}', kind: 'read', field: 'id', type: 'string' }, { op: 'GET /o/{id}', kind: 'read', field: 'total', type: 'number' }] }));
  return dir;
}
const quiet = (fn) => { const o = console.log, e = console.error; console.log = () => {}; console.error = () => {}; try { return fn(); } finally { console.log = o; console.error = e; } };

test('can-i-deploy returns 0 when safe', () => {
  const d = fixture();
  assert.strictEqual(quiet(() => main(['can-i-deploy', '--base', path.join(d, 'base.json'), '--candidate', path.join(d, 'base.json'), '--profiles', path.join(d, 'profiles')])), 0);
});
test('can-i-deploy returns 1 when breaking', () => {
  const d = fixture();
  assert.strictEqual(quiet(() => main(['can-i-deploy', '--base', path.join(d, 'base.json'), '--candidate', path.join(d, 'next.json'), '--profiles', path.join(d, 'profiles')])), 1);
});
test('coverage returns 1 below --min-coverage', () => {
  const d = fixture();
  assert.strictEqual(quiet(() => main(['coverage', '--spec', path.join(d, 'base.json'), '--profiles', path.join(d, 'profiles'), '--min-coverage', '90'])), 1);
});
test('missing file returns 2 (friendly error, no throw)', () => {
  assert.strictEqual(quiet(() => main(['can-i-deploy', '--base', 'nope.json', '--candidate', 'nope.json', '--profiles', 'nope'])), 2);
});
test('--help returns 0', () => { assert.strictEqual(quiet(() => main(['--help'])), 0); });
