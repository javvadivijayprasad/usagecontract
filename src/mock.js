'use strict';
// Mock server generated from per-consumer usage. Reuses the JSON Schema export: each recorded
// operation's schema (the minimal shape its consumers depend on) is turned into schema-valid
// fake data and served over HTTP, so a consumer can run with NO real provider present. Unlike
// whole-spec mockers, this serves exactly what consumers actually read. Scope is deliberately
// small: one valid response per operation (no stateful scenarios / request matching).
const http = require('http');
const { profileToJsonSchema } = require('./jsonschema');

function pick(type) {
  switch (type) {
    case 'string': return 'string';
    case 'integer': return 1;
    case 'number': return 1.5;
    case 'boolean': return true;
    default: return null;
  }
}

// Deterministic fake value that satisfies a (draft-07 subset) schema.
function fakeFromSchema(schema) {
  if (!schema || typeof schema !== 'object') return null;
  if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
  if (schema.type === 'object' || schema.properties) {
    const o = {};
    for (const [k, v] of Object.entries(schema.properties || {})) o[k] = fakeFromSchema(v);
    return o;
  }
  if (schema.type === 'array') return [fakeFromSchema(schema.items || {})];
  return pick(schema.type);
}

// Union two op schemas (different consumers may read different fields of the same operation).
function mergeSchema(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.type === 'array' || b.type === 'array') return { type: 'array', items: mergeSchema(a.items, b.items) };
  if (a.properties || b.properties) {
    const out = { type: 'object', properties: {}, required: [] };
    const keys = new Set([...Object.keys(a.properties || {}), ...Object.keys(b.properties || {})]);
    for (const k of keys) out.properties[k] = mergeSchema(a.properties && a.properties[k], b.properties && b.properties[k]);
    out.required = [...new Set([...(a.required || []), ...(b.required || [])])];
    return out;
  }
  return b.enum ? b : (a.type ? a : b);
}

// profiles -> { "GET /orders/{id}": mergedSchema, ... }
function responsesFor(profiles) {
  const byOp = {};
  for (const p of profiles) {
    for (const [op, s] of Object.entries(profileToJsonSchema(p))) {
      byOp[op] = byOp[op] ? mergeSchema(byOp[op], s) : s;
    }
  }
  return byOp;
}

function matchers(byOp) {
  return Object.keys(byOp).map((op) => {
    const sp = op.indexOf(' ');
    const method = op.slice(0, sp);
    const tmpl = op.slice(sp + 1);
    const re = '^' + tmpl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+') + '$';
    return { op, method, re: new RegExp(re) };
  });
}

// Build (but do not start) an http.Server that answers each recorded operation with fake data.
function createMockServer(profiles) {
  const byOp = responsesFor(profiles);
  const ms = matchers(byOp);
  return http.createServer((req, res) => {
    let pathname = req.url;
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { /* keep raw */ }
    const hit = ms.find((m) => m.method === req.method && m.re.test(pathname));
    if (!hit) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'no mock for ' + req.method + ' ' + pathname }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(fakeFromSchema(byOp[hit.op])));
  });
}

let LAST = null;
function startMock(profiles, opts) {
  const port = (opts && opts.port != null) ? opts.port : 3000;
  const server = createMockServer(profiles);
  server.listen(port);
  LAST = server;
  return server;
}
function _lastServer() { return LAST; }

module.exports = { fakeFromSchema, mergeSchema, responsesFor, createMockServer, startMock, _lastServer };
