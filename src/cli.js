'use strict';
const fs = require('fs');
const path = require('path');
const { compat, isBreaking } = require('./compat');
const { coverage } = require('./coverage');
const registry = require('./registry');
const { profileToJsonSchema } = require('./jsonschema');
const { startMock } = require('./mock');

function parse(argv) { const o = { _: [] }; for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true; o[k] = v; } else o._.push(a); } return o; }
const WARN = 0.8;
const pct = (x) => Math.round(x * 100) + '%';
function minOf(o) { return (o['min-coverage'] != null && o['min-coverage'] !== true) ? Number(o['min-coverage']) / 100 : null; }

const HELP = [
  'usagecontract - usage-aware, spec-anchored contract testing',
  '',
  'Commands:',
  '  can-i-deploy --candidate <spec> [--base <spec> | --registry <dir> [--provider <name>]]',
  '               --profiles <dir> [--min-coverage <0-100>] [--json]',
  '      Fail (exit 1) if the candidate spec breaks any recorded consumer. The baseline is',
  '      either --base (one spec) or resolved per-consumer from --registry by its specRef.',
  '',
  '  coverage --spec <spec> --profiles <dir> [--min-coverage <0-100>] [--json]',
  '  verify   --spec <spec> --profiles <dir>',
  '',
  '  push --registry <dir> [--spec <spec> --ref <provider@version>] [--profiles <dir>]',
  '      Store a provider spec (by ref) and/or publish profiles into the registry.',
  '  pull --registry <dir> --profiles-out <dir>',
  '      Fetch profiles from the registry into a local folder.',
  '',
  '  export-schema --profiles <dir> [--out <dir>] [--json]',
  '      Export each consumer profile to JSON Schema (the minimal shape it depends on),',
  '      grouped by operation. With --out, write <consumer>.schema.json files.',
  '',
  '  mock --profiles <dir> [--port <n>]',
  '      Start a local HTTP server that answers each recorded operation with schema-valid',
  '      fake data derived from the profiles — run a consumer with no real provider present.',
].join('\n');

function emit(json, obj, textFn) { if (json) console.log(JSON.stringify(obj, null, 2)); else textFn(); }

function canIDeploy(o) {
  if (!o.candidate || !o.profiles) { console.error('need --candidate and --profiles'); return 2; }
  const useRegistry = !!o.registry && !o.base;
  if (!useRegistry && !o.base) { console.error('need --base <spec> or --registry <dir>'); return 2; }
  const cand = registry.loadSpec(o.candidate);
  const provider = o.provider || (cand.info && cand.info.title) || null;
  const base = useRegistry ? null : registry.loadSpec(o.base);
  const profiles = registry.loadProfiles(o.profiles);
  if (profiles.length === 0) { console.error('no profiles found in ' + o.profiles); return 2; }
  const min = minOf(o), json = !!o.json;

  const rows = [];
  for (const p of profiles) {
    if (useRegistry && provider && p.provider && p.provider !== provider) continue; // gate only this provider
    const beforeSpec = useRegistry ? registry.loadSpecByRef(o.registry, p.specRef) : base;
    if (!beforeSpec) { rows.push({ consumer: p.consumer, skipped: true, reason: 'no baseline in registry for ' + p.specRef }); continue; }
    const br = isBreaking(beforeSpec, cand, p);
    const cov = coverage(beforeSpec, p);
    rows.push({ consumer: p.consumer, breaking: br.breaking, violations: br.violations, coveragePct: cov.pct, unread: Object.values(cov.perOp).flatMap(x => x.unread) });
  }
  const affected = rows.filter(r => r.breaking);
  const safe = rows.filter(r => !r.breaking && !r.skipped).map(r => r.consumer);
  const skipped = rows.filter(r => r.skipped);
  const covFail = min != null && rows.some(r => !r.skipped && r.coveragePct < min);

  emit(json, {
    verdict: affected.length ? 'BREAKING' : 'SAFE',
    checked: rows.length - skipped.length, provider,
    affected: affected.map(r => ({ consumer: r.consumer, reasons: r.violations.map(v => ({ field: v.field || v.op, reason: v.reason })) })),
    safe, skipped: skipped.map(r => ({ consumer: r.consumer, reason: r.reason })),
    coverage: rows.filter(r => !r.skipped).map(r => ({ consumer: r.consumer, pct: Math.round(r.coveragePct * 100), unread: r.unread })),
    coverageFail: covFail,
  }, () => {
    if (affected.length) {
      console.log('BREAKING: ' + affected.length + ' of ' + rows.length + ' consumer(s) affected:');
      for (const r of affected) console.log('  - ' + r.consumer + ': ' + r.violations.slice(0, 4).map(v => (v.field || v.op) + ' (' + v.reason + ')').join(', '));
      if (safe.length) console.log('  safe: ' + safe.join(', '));
    } else console.log('SAFE: candidate breaks none of ' + (rows.length - skipped.length) + ' consumer(s).');
    for (const s of skipped) console.log('  skipped ' + s.consumer + ': ' + s.reason);
    console.log('coverage (verdict confidence):');
    for (const r of rows) { if (r.skipped) continue; const low = r.coveragePct < WARN; console.log('  ' + (low ? '! ' : '  ') + r.consumer.padEnd(14) + pct(r.coveragePct) + (low && r.unread.length ? '  unread: ' + r.unread.slice(0, 6).join(', ') : '')); }
    if (covFail) console.log('FAIL: coverage below --min-coverage threshold.');
  });
  return (affected.length > 0 || covFail) ? 1 : 0;
}

function coverageCmd(o) {
  if (!o.spec || !o.profiles) { console.error('need --spec, --profiles'); return 2; }
  const spec = registry.loadSpec(o.spec), profiles = registry.loadProfiles(o.profiles), min = minOf(o), json = !!o.json; let fail = false;
  const rows = profiles.map(p => { const c = coverage(spec, p); if (min != null && c.pct < min) fail = true; return { consumer: p.consumer, pct: Math.round(c.pct * 100), perOp: c.perOp }; });
  emit(json, { coverage: rows.map(r => ({ consumer: r.consumer, pct: r.pct })), fail }, () => {
    for (const r of rows) { console.log(r.consumer + ': ' + r.pct + '%'); for (const [op, d] of Object.entries(r.perOp)) if (d.unread.length) console.log('  ' + op + ' unread: ' + d.unread.join(', ')); }
    if (fail) console.log('FAIL: coverage below --min-coverage threshold.');
  });
  return fail ? 1 : 0;
}

function verify(o) {
  if (!o.spec || !o.profiles) { console.error('need --spec, --profiles'); return 2; }
  const spec = registry.loadSpec(o.spec), profiles = registry.loadProfiles(o.profiles); let bad = 0;
  for (const p of profiles) { const c = compat(spec, p); if (!c.compatible) { bad++; console.log('INCOMPATIBLE ' + p.consumer + ': ' + c.violations.map(v => (v.field || v.op) + ' (' + v.reason + ')').join(', ')); } }
  if (!bad) { console.log('OK: all ' + profiles.length + ' profile(s) satisfied by spec.'); return 0; }
  return 1;
}

function exportSchema(o) {
  if (!o.profiles) { console.error('need --profiles <dir>'); return 2; }
  const profiles = registry.loadProfiles(o.profiles);
  if (profiles.length === 0) { console.error('no profiles found in ' + o.profiles); return 2; }
  const out = {};
  for (const p of profiles) out[p.consumer] = profileToJsonSchema(p);
  if (o.out && o.out !== true) {
    fs.mkdirSync(o.out, { recursive: true });
    for (const [consumer, schemas] of Object.entries(out)) {
      const f = path.join(o.out, consumer + '.schema.json');
      fs.writeFileSync(f, JSON.stringify(schemas, null, 2));
      console.log('wrote ' + f);
    }
    return 0;
  }
  emit(!!o.json, out, () => {
    for (const [consumer, schemas] of Object.entries(out)) {
      console.log(consumer + ':');
      for (const op of Object.keys(schemas)) console.log('  ' + op);
    }
  });
  return 0;
}

function mockCmd(o) {
  if (!o.profiles) { console.error('need --profiles <dir>'); return 2; }
  const profiles = registry.loadProfiles(o.profiles);
  if (profiles.length === 0) { console.error('no profiles found in ' + o.profiles); return 2; }
  const port = (o.port != null && o.port !== true) ? Number(o.port) : 3000;
  startMock(profiles, { port });
  console.log('usagecontract mock listening on http://localhost:' + port);
  console.log('serving ' + profiles.length + ' profile(s) as schema-valid fake responses; Ctrl+C to stop.');
  return 0;
}

function push(o) {
  if (!o.registry) { console.error('need --registry <dir>'); return 2; }
  let did = false;
  if (o.spec) { if (!o.ref) { console.error('--spec requires --ref <provider@version>'); return 2; } const f = registry.saveSpec(o.registry, o.ref, registry.loadSpec(o.spec)); console.log('stored spec ' + o.ref + ' -> ' + f); did = true; }
  if (o.profiles) { const n = registry.pushProfiles(o.profiles, o.registry); console.log('published ' + n + ' profile(s) to registry'); did = true; }
  if (!did) { console.error('nothing to push: pass --spec/--ref and/or --profiles'); return 2; }
  return 0;
}
function pull(o) {
  if (!o.registry || !o['profiles-out']) { console.error('need --registry and --profiles-out'); return 2; }
  const n = registry.pullProfiles(o.registry, o['profiles-out']); console.log('pulled ' + n + ' profile(s) into ' + o['profiles-out']); return 0;
}

function main(argv) {
  const cmd = argv[0]; const o = parse(argv.slice(1));
  if (!cmd || cmd === '--help' || cmd === '-h' || o.help) { console.log(HELP); return 0; }
  try {
    if (cmd === 'can-i-deploy') return canIDeploy(o);
    if (cmd === 'coverage') return coverageCmd(o);
    if (cmd === 'verify') return verify(o);
    if (cmd === 'push') return push(o);
    if (cmd === 'pull') return pull(o);
    if (cmd === 'export-schema') return exportSchema(o);
    if (cmd === 'mock') return mockCmd(o);
    console.error('unknown command: ' + cmd); console.log(HELP); return 2;
  } catch (e) {
    if (e && e.code === 'ENOENT') console.error('error: file not found: ' + e.path);
    else console.error('error: ' + ((e && e.message) || e));
    return 2;
  }
}
module.exports = { main };
