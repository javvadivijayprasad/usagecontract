'use strict';
// Coverage reporting: how much of what an operation CAN return did the consumer
// actually read? Low coverage means a "SAFE" verdict may be unreliable, because a
// field the app really uses in production might simply never be exercised by tests.
const { deref, expand, getResponseSchema } = require('./spec');

const SCALAR = ['string', 'integer', 'number', 'boolean'];
const join = (p, n) => (p ? p + '.' + n : n);

// Enumerate reachable leaf field paths of a response schema (handles $ref, allOf,
// oneOf/anyOf, arrays; depth-capped + ref-cycle guarded).
function walkLeaves(spec, schema, prefix, depth, out, seen) {
  if (depth > 8) return;
  if (schema && schema.$ref) { if (seen.has(schema.$ref)) return; seen = new Set(seen); seen.add(schema.$ref); }
  const s = expand(spec, schema);
  if (!s) return;
  if (s.oneOf || s.anyOf) { for (const b of (s.oneOf || s.anyOf)) walkLeaves(spec, b, prefix, depth + 1, out, seen); return; }
  if (s.type === 'object' && s.properties) { for (const [n, c] of Object.entries(s.properties)) walkLeaves(spec, c, join(prefix, n), depth + 1, out, seen); return; }
  if (s.type === 'array' && s.items) {
    const items = deref(spec, s.items), cp = prefix + '[]';
    if (items && items.type === 'object') walkLeaves(spec, items, cp, depth + 1, out, seen);
    else if (items && SCALAR.includes(items.type)) out.add(cp);
    return;
  }
  if (SCALAR.includes(s.type)) out.add(prefix);
}

function reachableLeaves(spec, op) {
  const resp = getResponseSchema(spec, op);
  const out = new Set();
  if (resp) walkLeaves(spec, resp, '', 0, out, new Set());
  return out;
}

// coverage(spec, profile) -> per-op and overall read/reachable, plus unread fields.
function coverage(spec, profile) {
  const readByOp = {};
  for (const d of profile.dependencies) if (d.kind === 'read') (readByOp[d.op] = readByOp[d.op] || new Set()).add(d.field);
  const perOp = {}; let totalRead = 0, totalReachable = 0;
  for (const op of Object.keys(readByOp)) {
    const reachable = reachableLeaves(spec, op);
    const read = readByOp[op];
    const unread = [...reachable].filter(f => !read.has(f)).sort();
    const rc = reachable.size || read.size; // fall back if response not resolvable
    perOp[op] = { read: read.size, reachable: rc, unread };
    totalRead += read.size; totalReachable += rc;
  }
  const pct = totalReachable ? totalRead / totalReachable : 1;
  return { consumer: profile.consumer, perOp, read: totalRead, reachable: totalReachable, pct };
}

module.exports = { coverage, reachableLeaves };
