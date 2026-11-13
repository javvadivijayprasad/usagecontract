'use strict';
// Export a usage profile to JSON Schema. A profile's read dependencies are flat dot/bracket
// paths (e.g. "order.items[].sku"); this rebuilds the nested object/array structure into a
// standard JSON Schema per operation — the minimal shape the consumer actually depends on.
// This is a read/export path only; it does not affect gating.

const DRAFT = 'http://json-schema.org/draft-07/schema#';

function leafSchema(dep) {
  const s = dep.type ? { type: dep.type } : {};
  if (Array.isArray(dep.enum)) s.enum = dep.enum.slice();
  return s;
}
function wrapArrays(n, base) { let s = base; for (let i = 0; i < n; i++) s = { type: 'array', items: s }; return s; }
function objectSchema() { return { type: 'object', properties: {}, required: [] }; }

// Insert one dependency's field path into an object schema, creating nested objects/arrays.
function insert(rootObj, dep) {
  const parts = String(dep.field).split('.').filter(Boolean);
  let node = rootObj; // always an object schema here
  for (let i = 0; i < parts.length; i++) {
    let seg = parts[i];
    let arr = 0;
    while (seg.endsWith('[]')) { arr++; seg = seg.slice(0, -2); }
    if (!seg) continue;
    const isLeaf = i === parts.length - 1;
    node.properties = node.properties || {};
    node.required = node.required || [];
    if (!node.required.includes(seg)) node.required.push(seg);

    let child = node.properties[seg];
    if (!child) {
      child = wrapArrays(arr, isLeaf ? leafSchema(dep) : objectSchema());
      node.properties[seg] = child;
    }
    // Descend past any array wrappers to the underlying schema.
    let inner = child;
    for (let a = 0; a < arr; a++) { if (inner.type !== 'array' || !inner.items) inner.items = objectSchema(), inner.type = 'array'; inner = inner.items; }

    if (!isLeaf) {
      if (inner.type !== 'object') { inner.type = 'object'; inner.properties = inner.properties || {}; inner.required = inner.required || []; }
      node = inner;
    }
  }
}

// profile -> { "GET /orders/{id}": <JSON Schema>, ... }
function profileToJsonSchema(profile) {
  const out = {};
  for (const dep of (profile && profile.dependencies) || []) {
    if (dep.kind !== 'read' || !dep.field) continue;
    if (!out[dep.op]) out[dep.op] = Object.assign({ $schema: DRAFT }, objectSchema());
    insert(out[dep.op], dep);
  }
  return out;
}

module.exports = { profileToJsonSchema };
