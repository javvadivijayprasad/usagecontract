'use strict';
// OpenAPI spec utilities: $ref resolution, allOf merging, oneOf/anyOf branching,
// operation lookup, and field-path resolution. Handles the composition constructs
// real-world specs use (inheritance via allOf, polymorphism via oneOf/anyOf).
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function deref(spec, schema) {
  let s = schema; const seen = new Set();
  while (s && s.$ref) {
    if (seen.has(s.$ref)) break; seen.add(s.$ref);
    let cur = spec; for (const p of s.$ref.replace(/^#\//, '').split('/')) cur = cur && cur[p];
    s = cur;
  }
  return s;
}
// Merge allOf members into a single object schema; leave oneOf/anyOf intact.
function expand(spec, schema) {
  const s = deref(spec, schema);
  if (!s || !s.allOf) return s;
  const merged = { type: 'object', properties: {}, required: [] };
  for (const part of s.allOf) {
    const e = expand(spec, part);
    if (e && e.properties) Object.assign(merged.properties, e.properties);
    if (e && Array.isArray(e.required)) merged.required.push(...e.required);
    if (e && e.type && e.type !== 'object') merged.type = e.type;
  }
  if (s.properties) Object.assign(merged.properties, s.properties);
  if (Array.isArray(s.required)) merged.required.push(...s.required);
  return merged;
}
function parseOpId(opId) { const i = opId.indexOf(' '); return { method: opId.slice(0, i).toLowerCase(), path: opId.slice(i + 1) }; }
function getOperation(spec, opId) { const { method, path } = parseOpId(opId); const it = spec.paths && spec.paths[path]; return it && it[method] ? it[method] : null; }
function getResponseSchema(spec, opId) {
  const op = getOperation(spec, opId); if (!op || !op.responses) return null;
  const code = op.responses['200'] ? '200' : (op.responses['201'] ? '201' : null); if (!code) return null;
  const c = op.responses[code].content && op.responses[code].content['application/json']; if (!c) return null;
  return deref(spec, c.schema);
}
function getRequestParams(spec, opId) { const op = getOperation(spec, opId); return op ? (op.parameters || []).map(p => ({ name: p.name, in: p.in, required: !!p.required })) : []; }
function tokenizePath(fp) { return fp.split('.').map(seg => { const a = seg.endsWith('[]'); return { name: a ? seg.slice(0, -2) : seg, array: a }; }); }
function resolveTokens(spec, schema, tokens, requiredInParent) {
  if (tokens.length === 0) return { found: true, schema: expand(spec, schema), requiredInParent };
  const s = expand(spec, schema);
  if (!s) return { found: false };
  if (s.oneOf || s.anyOf) { for (const b of (s.oneOf || s.anyOf)) { const r = resolveTokens(spec, b, tokens, requiredInParent); if (r.found) return r; } return { found: false }; }
  if (s.type !== 'object' || !s.properties) return { found: false };
  const t = tokens[0]; const child = s.properties[t.name]; if (!child) return { found: false };
  const req = (s.required || []).includes(t.name);
  let cs = expand(spec, child);
  if (t.array) { if (!cs || cs.type !== 'array') return { found: false, typeMismatch: true }; cs = cs.items; }
  return resolveTokens(spec, cs, tokens.slice(1), req);
}
function resolveField(spec, rootSchema, fieldPath) { return resolveTokens(spec, rootSchema, tokenizePath(fieldPath), false); }
function typeCompatible(declared, relied) { if (declared === relied) return true; if (relied === 'number' && declared === 'integer') return true; return false; }
module.exports = { clone, deref, expand, parseOpId, getOperation, getResponseSchema, getRequestParams, tokenizePath, resolveField, typeCompatible };
