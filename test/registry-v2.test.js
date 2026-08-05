'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const registry = require('../src/registry');

test('saveSpec / loadSpecByRef round-trip by ref', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-reg-'));
  const spec = { openapi: '3.0.0', info: { title: 'orders', version: '1.0.0' }, paths: {} };
  registry.saveSpec(dir, 'orders@1.0.0', spec);
  const loaded = registry.loadSpecByRef(dir, 'orders@1.0.0');
  assert.strictEqual(loaded.info.title, 'orders');
  assert.strictEqual(registry.loadSpecByRef(dir, 'nope@9'), null);
  assert.ok(registry.listSpecs(dir).length === 1);
});

test('pushProfiles then pullProfiles moves profiles through the registry', () => {
  const src = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-src-'));
  const reg = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-reg2-'));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-out-'));
  registry.saveProfile(src, { consumer: 'web-app', provider: 'orders', dependencies: [] });
  assert.strictEqual(registry.pushProfiles(src, reg), 1);
  assert.strictEqual(registry.pullProfiles(reg, out), 1);
  assert.strictEqual(registry.loadProfiles(out)[0].consumer, 'web-app');
});
