'use strict';
// Usage-relative compatibility engine.
//   compat(spec, profile)         -> { compatible, violations[] }
//   isBreaking(before, after, P)  -> { breaking, baselineCompatible, violations[] }
const { getResponseSchema, getRequestParams, resolveField, typeCompatible } = require('./spec');
function checkDependency(spec, dep) {
  const v = (reason) => ({ op: dep.op, field: dep.field, kind: dep.kind, reason });
  if (dep.kind === 'send') { if (getRequestParams(spec, dep.op).length === 0 && !getResponseSchema(spec, dep.op)) return v('operation-removed'); return null; }
  const resp = getResponseSchema(spec, dep.op); if (!resp) return v('operation-removed');
  const r = resolveField(spec, resp, dep.field); if (!r.found) return v('field-removed-or-renamed');
  const dt = r.schema && r.schema.type;
  if (dep.type && dt && !typeCompatible(dt, dep.type)) return v('type-changed');
  if (dep.enum && dep.exhaustive && r.schema && Array.isArray(r.schema.enum)) { const added = r.schema.enum.filter(x => !new Set(dep.enum).has(x)); if (added.length) return v('enum-widened'); }
  return null;
}
function compat(spec, profile) { const violations = []; for (const dep of profile.dependencies) { const x = checkDependency(spec, dep); if (x) violations.push(x); } return { compatible: violations.length === 0, violations }; }
function requiredness(spec, dep) { const resp = getResponseSchema(spec, dep.op); if (!resp) return { present: false, required: false }; const r = resolveField(spec, resp, dep.field); return { present: r.found, required: r.found ? r.requiredInParent : false }; }
function reqParams(spec, op) { return new Set(getRequestParams(spec, op).filter(p => p.required && p.in !== 'path').map(p => p.name)); }
function isBreaking(before, after, profile) {
  const b = compat(before, profile), a = compat(after, profile), transitions = [];
  if (b.compatible) {
    for (const dep of profile.dependencies) { if (dep.kind !== 'read') continue; const rb = requiredness(before, dep), ra = requiredness(after, dep); if (rb.present && rb.required && ra.present && !ra.required) transitions.push({ op: dep.op, field: dep.field, reason: 'field-made-optional' }); }
    for (const op of new Set(profile.dependencies.map(d => d.op))) { const sent = new Set(profile.dependencies.filter(d => d.op === op && d.kind === 'send').map(d => d.field)); const pb = reqParams(before, op), pa = reqParams(after, op); for (const n of pa) if (!pb.has(n) && !sent.has(n)) transitions.push({ op, field: n, reason: 'new-required-param' }); }
  }
  return { breaking: b.compatible && (!a.compatible || transitions.length > 0), baselineCompatible: b.compatible, violations: a.violations.concat(transitions) };
}
module.exports = { compat, isBreaking };
