'use strict';
const fs = require('fs'), path = require('path');
const recorder = require('./recorder');
const { compat, isBreaking } = require('./compat');
const { coverage } = require('./coverage');
const registry = require('./registry');

const record = {
  install: (spec) => recorder.install(spec),
  uninstall: () => recorder.uninstall(),
  installAxios: (axios, spec) => recorder.installAxios(axios, spec),
  installGot: (got, spec) => recorder.installGot(got, spec),
  installUndici: (undici, spec) => recorder.installUndici(undici, spec),
  start: (meta) => recorder.startConsumer(meta),
  stop: (consumer) => recorder.stopConsumer(consumer),
  // Stop + write the profile. { merge: true } unions with an existing profile on disk
  // (for accumulating across test runs / CI shards).
  flush: (consumer, opts) => {
    opts = opts || {};
    let p = recorder.stopConsumer(consumer);
    const dir = opts.dir || './profiles';
    if (opts.merge) {
      const prev = registry.loadProfile(dir, consumer);
      if (prev) p = registry.mergeProfiles(prev, p);
    }
    return registry.saveProfile(dir, p);
  },
  merge: (a, b) => registry.mergeProfiles(a, b),
};

module.exports = { record, compat, isBreaking, coverage, registry, wrap: recorder.wrap };
