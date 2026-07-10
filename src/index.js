'use strict';
const recorder = require('./recorder');
const { compat, isBreaking } = require('./compat');
const { coverage } = require('./coverage');
const registry = require('./registry');
const record = {
  install: (spec) => recorder.install(spec),
  uninstall: () => recorder.uninstall(),
  start: (meta) => recorder.startConsumer(meta),
  stop: (consumer) => recorder.stopConsumer(consumer),
  // Convenience: stop + write the profile to a registry directory.
  installAxios: (axios, spec) => recorder.installAxios(axios, spec),
  installGot: (got, spec) => recorder.installGot(got, spec),
  installUndici: (undici, spec) => recorder.installUndici(undici, spec),
  flush: (consumer, opts) => { const p = recorder.stopConsumer(consumer); return registry.saveProfile((opts && opts.dir) || './profiles', p); },
};
module.exports = { record, compat, isBreaking, coverage, registry, wrap: recorder.wrap };
