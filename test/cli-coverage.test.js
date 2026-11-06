'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { spawnSync } = require('child_process');

const cli = path.join(__dirname, '..', 'bin', 'usagecontract.js');
const response = (properties) => ({ get: { responses: { '200': { content: {
  'application/json': { schema: { type: 'object', properties } },
} } } } });
const read = (op, field) => ({ op, kind: 'read', field });
const expectedRows = [
  { consumer: 'alpha', pct: 67, perOp: {
    'GET /orders/{id}': { read: 3, reachable: 6, unread: ['currency', 'id', 'items[].qty'] },
    'GET /users/{id}': { read: 3, reachable: 3, unread: [] },
  } },
  { consumer: 'beta', pct: 100, perOp: {
    'GET /users/{id}': { read: 3, reachable: 3, unread: [] },
  } },
  { consumer: 'send-only', pct: 100, perOp: {} },
];

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-coverage cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const spec = { openapi: '3.0.0', info: { title: 'synthetic', version: '1' }, paths: {
    '/orders/{id}': response({ id: { type: 'string' }, status: { type: 'string' },
      total: { type: 'number' }, currency: { type: 'string' },
      items: { type: 'array', items: { type: 'object', properties: {
        sku: { type: 'string' }, qty: { type: 'integer' },
      } } },
    }),
    '/users/{id}': response({ id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' } }),
  } };
  const users = ['id', 'name', 'email'].map(f => read('GET /users/{id}', f));
  const profiles = [
    { consumer: 'alpha', dependencies: ['status', 'total', 'items[].sku']
      .map(f => read('GET /orders/{id}', f)).concat(users) },
    { consumer: 'beta', dependencies: users },
    { consumer: 'send-only', dependencies: [{ op: 'POST /events', kind: 'send', field: 'payload' }] },
  ];
  fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify(spec));
  fs.mkdirSync(path.join(dir, 'profiles'));
  for (const p of profiles) fs.writeFileSync(path.join(dir, 'profiles', p.consumer + '.profile.json'), JSON.stringify(p));
  return dir;
}

function run(dir, args = [], spec = 'spec.json') {
  const result = spawnSync(process.execPath, [cli, 'coverage', '--spec', spec, '--profiles', 'profiles', ...args],
    { cwd: dir, encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error);
  assert.strictEqual(result.signal, null);
  assert.notStrictEqual(result.status, null);
  return result;
}

function assertJson(result, fail) {
  assert.strictEqual(result.status, fail ? 1 : 0);
  assert.strictEqual(result.stderr, '');
  const output = JSON.parse(result.stdout);
  output.coverage.sort((a, b) => a.consumer.localeCompare(b.consumer));
  assert.deepStrictEqual(output, { coverage: expectedRows, fail });
}

test('coverage --json exposes each consumer\'s operation counts and complete unread paths', (t) => {
  assertJson(run(fixture(t), ['--json']), false);
});

for (const [threshold, fail] of [['0', false], ['66.66', false], ['66.67', true], ['67', true], ['100', true]]) {
  test('coverage --json keeps unrounded threshold semantics at ' + threshold + '%', (t) => {
    assertJson(run(fixture(t), ['--json', '--min-coverage', threshold]), fail);
  });
}

test('coverage --json passes exactly at the threshold with fully read and send-only profiles', (t) => {
  const dir = fixture(t);
  fs.unlinkSync(path.join(dir, 'profiles', 'alpha.profile.json'));
  const result = run(dir, ['--json', '--min-coverage', '100']);
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, '');
  const output = JSON.parse(result.stdout);
  output.coverage.sort((a, b) => a.consumer.localeCompare(b.consumer));
  assert.deepStrictEqual(output, { coverage: expectedRows.slice(1), fail: false });
});

test('coverage text retains percentages, unread paths, threshold message and exit status', (t) => {
  const dir = fixture(t);
  const lines = ['alpha: 67%', '  GET /orders/{id} unread: currency, id, items[].qty', 'beta: 100%', 'send-only: 100%', ''];
  for (const [args, fail] of [[[], false], [['--min-coverage', '66.67'], true]]) {
    const result = run(dir, args);
    assert.strictEqual(result.status, fail ? 1 : 0);
    assert.strictEqual(result.stderr, '');
    const expected = fail ? lines.concat('FAIL: coverage below --min-coverage threshold.') : lines;
    assert.deepStrictEqual(result.stdout.split(/\r?\n/).sort(), expected.slice().sort());
  }
});

test('coverage --json retains bad-input exit code and stderr', (t) => {
  const dir = fixture(t);
  const missingSpec = path.join(dir, 'spec.json');
  fs.unlinkSync(missingSpec);
  // An absolute input makes ENOENT.path consistent across Node versions on Windows.
  const result = run(dir, ['--json'], missingSpec);
  assert.strictEqual(result.status, 2);
  assert.strictEqual(result.stdout, '');
  assert.strictEqual(result.stderr.replace(/\r\n/g, '\n'), 'error: file not found: ' + missingSpec + '\n');
});

test('coverage --json retains an empty result when there are no profiles', (t) => {
  const dir = fixture(t);
  for (const f of fs.readdirSync(path.join(dir, 'profiles'))) fs.unlinkSync(path.join(dir, 'profiles', f));
  const result = run(dir, ['--json', '--min-coverage', '100']);
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, '');
  assert.deepStrictEqual(JSON.parse(result.stdout), { coverage: [], fail: false });
});
