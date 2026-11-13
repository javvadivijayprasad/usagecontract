'use strict';
// Cross-platform test runner. `node --test test/*.test.js` relies on the SHELL expanding the
// glob, which Windows does not do (and node only expands globs itself on node 21+), so the
// matrix failed on Windows + node 18/20. Here we enumerate the test files ourselves and pass
// them explicitly, which works on every OS and on node 18+. Pass --coverage to enforce the floor.
const { readdirSync } = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

const testDir = path.join(__dirname, '..', 'test');
const files = readdirSync(testDir)
  .filter((f) => f.endsWith('.test.js'))
  .map((f) => path.join('test', f));

const args = ['--test'];
if (process.argv.includes('--coverage')) {
  args.push('--experimental-test-coverage', '--test-coverage-lines=90',
    '--test-coverage-branches=75', '--test-coverage-functions=90');
}
args.push(...files);

const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
process.exit(result.status === null ? 1 : result.status);
