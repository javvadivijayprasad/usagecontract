'use strict';
// W8: the global-fetch patcher must restore cleanly. Node's global fetch is undici-backed, so a
// leaked wrapper bleeds into every later test. These tests assert install/uninstall is symmetric
// and idempotent.
const test = require('node:test'); const assert = require('node:assert');
const { record } = require('../src/index');

const spec = { openapi: '3.0.0', info: { title: 't', version: '1' }, paths: {}, components: { schemas: {} } };

test('uninstall restores the exact original global fetch', () => {
  const original = globalThis.fetch;
  record.install(spec);
  assert.notStrictEqual(globalThis.fetch, original, 'install should replace global fetch');
  record.uninstall();
  assert.strictEqual(globalThis.fetch, original, 'uninstall must restore the original reference');
});

test('repeated install/uninstall cycles stay clean (no double-wrapping)', () => {
  const original = globalThis.fetch;
  for (let i = 0; i < 3; i++) {
    record.install(spec);
    record.uninstall();
  }
  assert.strictEqual(globalThis.fetch, original);
});

test('double install then one uninstall still restores the original', () => {
  const original = globalThis.fetch;
  record.install(spec);
  record.install(spec);            // second install must not capture the wrapper as "original"
  record.uninstall();
  assert.strictEqual(globalThis.fetch, original);
});

test('uninstall is a safe no-op when not installed', () => {
  const original = globalThis.fetch;
  record.uninstall();              // nothing installed
  assert.strictEqual(globalThis.fetch, original);
});

test('a patched then unpatched fetch behaves like the original (no leaked wrapper)', async () => {
  const http = require('http');
  const s = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify({ ok: true })); });
  await new Promise((res) => s.listen(0, '127.0.0.1', res));
  const base = 'http://127.0.0.1:' + s.address().port;

  record.install(spec);
  record.uninstall();
  // After teardown, fetch is the real one: it returns a genuine Response with a working .json().
  const resp = await fetch(base + '/');
  assert.strictEqual(typeof resp.ok, 'boolean');
  const body = await resp.json();
  assert.deepStrictEqual(body, { ok: true });
  s.close();
});
