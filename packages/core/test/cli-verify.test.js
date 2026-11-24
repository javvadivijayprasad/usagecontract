'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { spawnSync } = require('child_process');

const cli = path.join(__dirname, '..', 'bin', 'usagecontract.js');
const read = (field) => ({ op: 'GET /users/{id}', kind: 'read', field });

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-verify cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const spec = { openapi: '3.0.0', info: { title: 'synthetic', version: '1' }, paths: {
    '/users/{id}': { get: { responses: { '200': { content: { 'application/json': { schema: {
      type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } },
    } } } } } } },
  } };
  const profiles = [
    { consumer: 'web', dependencies: [read('id'), read('name')] },
    { consumer: 'mobile', dependencies: [read('name'), read('email')] },
  ];
  fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify(spec));
  fs.mkdirSync(path.join(dir, 'profiles'));
  for (const p of profiles) fs.writeFileSync(path.join(dir, 'profiles', p.consumer + '.profile.json'), JSON.stringify(p));
  return dir;
}

function run(dir, args = [], spec = 'spec.json') {
  const result = spawnSync(process.execPath, [cli, 'verify', '--spec', spec, '--profiles', 'profiles', ...args],
    { cwd: dir, encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error);
  assert.strictEqual(result.signal, null);
  return result;
}

const byConsumer = (a, b) => a.consumer.localeCompare(b.consumer);

test('verify --json reports every consumer, its violations and exits 1 when one is incompatible', (t) => {
  const result = run(fixture(t), ['--json']);
  assert.strictEqual(result.status, 1);
  assert.strictEqual(result.stderr, '');
  const output = JSON.parse(result.stdout);
  output.results.sort(byConsumer);
  assert.deepStrictEqual(output, { verdict: 'INCOMPATIBLE', checked: 2, results: [
    { consumer: 'mobile', compatible: false, violations: [{ field: 'email', reason: 'field-removed-or-renamed' }] },
    { consumer: 'web', compatible: true, violations: [] },
  ] });
});

test('verify --json reports OK and exits 0 when every profile is satisfied', (t) => {
  const dir = fixture(t);
  fs.unlinkSync(path.join(dir, 'profiles', 'mobile.profile.json'));
  const result = run(dir, ['--json']);
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, '');
  assert.deepStrictEqual(JSON.parse(result.stdout), { verdict: 'OK', checked: 1, results: [
    { consumer: 'web', compatible: true, violations: [] },
  ] });
});

test('verify text output and exit codes are unchanged', (t) => {
  const dir = fixture(t);
  let result = run(dir);
  assert.strictEqual(result.status, 1);
  assert.strictEqual(result.stdout, 'INCOMPATIBLE mobile: email (field-removed-or-renamed)\n');
  fs.unlinkSync(path.join(dir, 'profiles', 'mobile.profile.json'));
  result = run(dir);
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout, 'OK: all 1 profile(s) satisfied by spec.\n');
});

test('verify --json keeps bad-input exit code and prints nothing to stdout', (t) => {
  const dir = fixture(t);
  const missingSpec = path.join(dir, 'spec.json');
  fs.unlinkSync(missingSpec);
  const result = run(dir, ['--json'], missingSpec);
  assert.strictEqual(result.status, 2);
  assert.strictEqual(result.stdout, '');
  assert.match(result.stderr, /error: file not found/);
});
