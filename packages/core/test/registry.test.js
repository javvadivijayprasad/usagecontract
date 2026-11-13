'use strict';
const test = require('node:test'); const assert = require('node:assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const registry = require('../src/registry');

test('saveProfile then loadProfiles round-trips', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-'));
  const profile = { consumer: 'web-app', provider: 'orders', dependencies: [{ op: 'GET /o', kind: 'read', field: 'id' }] };
  const file = registry.saveProfile(dir, profile);
  assert.ok(fs.existsSync(file));
  const loaded = registry.loadProfiles(dir);
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].consumer, 'web-app');
  assert.deepStrictEqual(loaded[0].dependencies[0], { op: 'GET /o', kind: 'read', field: 'id' });
});
test('loadProfiles on empty/missing dir returns []', () => {
  assert.deepStrictEqual(registry.loadProfiles(path.join(os.tmpdir(), 'does-not-exist-uc')), []);
});
