'use strict';
const { compat, isBreaking } = require('./compat');
const { coverage } = require('./coverage');
const registry = require('./registry');

function parse(argv) { const o = { _: [] }; for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true; o[k] = v; } else o._.push(a); } return o; }
const WARN = 0.8;
const pct = (x) => Math.round(x * 100) + '%';

const HELP = [
  'usagecontract - usage-aware, spec-anchored contract testing',
  '',
  'Usage:',
  '  usagecontract can-i-deploy --base <spec.json> --candidate <spec.json> --profiles <dir> [--min-coverage <0-100>]',
  '      Fail (exit 1) if the candidate spec breaks any recorded consumer profile.',
  '      Prints the blast radius and each consumer field coverage. With --min-coverage,',
  '      also fails if any consumer coverage is below the given percentage.',
  '',
  '  usagecontract coverage --spec <spec.json> --profiles <dir> [--min-coverage <0-100>]',
  '      Report how much of each operation the consumer actually exercised.',
  '',
  '  usagecontract verify --spec <spec.json> --profiles <dir>',
  '      Check that every recorded profile is satisfied by the spec.',
  '',
  'Profiles are JSON files (<consumer>.profile.json) emitted by record.flush() in tests.',
].join('\n');

function minOf(o) { return (o['min-coverage'] != null && o['min-coverage'] !== true) ? Number(o['min-coverage']) / 100 : null; }

function covLine(spec, p) {
  const c = coverage(spec, p);
  const low = c.pct < WARN;
  const unread = Object.values(c.perOp).flatMap(o => o.unread);
  let s = '  ' + (low ? '! ' : '  ') + 'coverage ' + p.consumer.padEnd(14) + pct(c.pct) + ' (' + c.read + '/' + c.reachable + ' fields)';
  if (low && unread.length) s += '  unread: ' + unread.slice(0, 6).join(', ') + (unread.length > 6 ? ', ...' : '');
  return { line: s, pct: c.pct };
}

function canIDeploy(o) {
  if (!o.base || !o.candidate || !o.profiles) { console.error('need --base, --candidate, --profiles'); return 2; }
  const base = registry.loadSpec(o.base), cand = registry.loadSpec(o.candidate), profiles = registry.loadProfiles(o.profiles);
  if (profiles.length === 0) { console.error('no profiles found in ' + o.profiles); return 2; }
  const affected = [];
  for (const p of profiles) { const r = isBreaking(base, cand, p); if (r.breaking) affected.push({ consumer: p.consumer, violations: r.violations }); }
  if (affected.length === 0) console.log('SAFE: candidate spec breaks none of ' + profiles.length + ' consumer(s).');
  else {
    console.log('BREAKING: ' + affected.length + ' of ' + profiles.length + ' consumer(s) affected:');
    for (const a of affected) console.log('  - ' + a.consumer + ': ' + a.violations.slice(0, 4).map(v => (v.field || v.op) + ' (' + v.reason + ')').join(', '));
    const safe = profiles.map(p => p.consumer).filter(c => !affected.find(a => a.consumer === c));
    if (safe.length) console.log('  safe: ' + safe.join(', '));
  }
  const min = minOf(o); let covFail = false, anyLow = false;
  console.log('coverage (verdict confidence - how much each consumer exercised the API):');
  for (const p of profiles) { const { line, pct: cp } = covLine(base, p); console.log(line); if (cp < WARN) anyLow = true; if (min != null && cp < min) covFail = true; }
  if (anyLow && min == null) console.log('  note: low coverage means a SAFE result may miss fields your tests never read');
  if (covFail) console.log('FAIL: coverage below --min-coverage threshold.');
  return (affected.length > 0 || covFail) ? 1 : 0;
}

function coverageCmd(o) {
  if (!o.spec || !o.profiles) { console.error('need --spec, --profiles'); return 2; }
  const spec = registry.loadSpec(o.spec), profiles = registry.loadProfiles(o.profiles), min = minOf(o); let fail = false;
  for (const p of profiles) {
    const c = coverage(spec, p);
    console.log(p.consumer + ': ' + pct(c.pct) + ' (' + c.read + '/' + c.reachable + ' fields)');
    for (const [op, d] of Object.entries(c.perOp)) if (d.unread.length) console.log('  ' + op + ' unread: ' + d.unread.join(', '));
    if (min != null && c.pct < min) fail = true;
  }
  if (fail) { console.log('FAIL: coverage below --min-coverage threshold.'); return 1; }
  return 0;
}

function verify(o) {
  if (!o.spec || !o.profiles) { console.error('need --spec, --profiles'); return 2; }
  const spec = registry.loadSpec(o.spec), profiles = registry.loadProfiles(o.profiles); let bad = 0;
  for (const p of profiles) { const c = compat(spec, p); if (!c.compatible) { bad++; console.log('INCOMPATIBLE ' + p.consumer + ': ' + c.violations.map(v => (v.field || v.op) + ' (' + v.reason + ')').join(', ')); } }
  if (!bad) { console.log('OK: all ' + profiles.length + ' profile(s) satisfied by spec.'); return 0; }
  return 1;
}

function main(argv) {
  const cmd = argv[0]; const o = parse(argv.slice(1));
  if (!cmd || cmd === '--help' || cmd === '-h' || o.help) { console.log(HELP); return 0; }
  try {
    if (cmd === 'can-i-deploy') return canIDeploy(o);
    if (cmd === 'coverage') return coverageCmd(o);
    if (cmd === 'verify') return verify(o);
    console.error('unknown command: ' + cmd); console.log(HELP); return 2;
  } catch (e) {
    if (e && e.code === 'ENOENT') console.error('error: file not found: ' + e.path);
    else console.error('error: ' + ((e && e.message) || e));
    return 2;
  }
}
module.exports = { main };
