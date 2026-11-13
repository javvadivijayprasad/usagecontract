'use strict';
// Pure, vscode-free core for the usagecontract VS Code extension. All logic that can be
// unit-tested with `node --test` lives here; extension.js is a thin vscode glue layer on
// top. This wraps the published @vijaypjavvadi/usagecontract package.
const fs = require('fs');
const { isBreaking, coverage, registry } = require('@vijaypjavvadi/usagecontract');

function loadJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function loadProfiles(dir) { return registry.loadProfiles(dir); }

// Gate a candidate spec against a base spec for every consumer profile.
function gate(baseSpec, candidateSpec, profiles) {
  const results = profiles.map((p) => {
    const r = isBreaking(baseSpec, candidateSpec, p);
    return { consumer: p.consumer, breaking: r.breaking, baselineCompatible: r.baselineCompatible, violations: r.violations };
  });
  const breakingConsumers = results.filter((r) => r.breaking).map((r) => r.consumer);
  return { ok: breakingConsumers.length === 0, breakingConsumers, results };
}

// Per-consumer coverage of the spec's reachable fields.
function coverageReport(spec, profiles) {
  return profiles.map((p) => Object.assign({ consumer: p.consumer }, coverage(spec, p)));
}

// Convert a character offset in text to a zero-based {line, character} position.
function offsetToPos(text, idx) {
  let line = 0, lineStart = 0;
  for (let i = 0; i < idx && i < text.length; i++) {
    if (text[i] === '\n') { line++; lineStart = i + 1; }
  }
  return { line, character: idx - lineStart };
}

// Best-effort location of a violation in the candidate spec's JSON text, so the editor can
// place a squiggle. Prefers the field's last path segment, then the operation's path.
function locate(text, violation) {
  const targets = [];
  if (violation.field) {
    const seg = String(violation.field).split(/[.[\]]/).filter(Boolean).pop();
    if (seg) targets.push(seg);
  }
  if (violation.op) {
    const parts = String(violation.op).split(' ');
    targets.push(parts[parts.length - 1]);
  }
  for (const t of targets) {
    const idx = text.indexOf('"' + t + '"');
    if (idx >= 0) return offsetToPos(text, idx);
  }
  return { line: 0, character: 0 };
}

// Build a flat list of breaking-change diagnostics from base/candidate specs + profiles.
function diagnostics(baseSpec, candidateSpec, candidateText, profiles) {
  const out = [];
  for (const r of gate(baseSpec, candidateSpec, profiles).results) {
    if (!r.breaking) continue;
    for (const v of r.violations) {
      const pos = locate(candidateText, v);
      out.push({
        consumer: r.consumer, op: v.op, field: v.field, reason: v.reason,
        line: pos.line, character: pos.character,
        message: `Breaking for ${r.consumer}: ${v.reason} (${v.op}${v.field ? ' · ' + v.field : ''})`,
      });
    }
  }
  return out;
}

module.exports = { loadJson, loadProfiles, gate, coverageReport, diagnostics, locate, offsetToPos };
