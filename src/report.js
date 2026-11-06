'use strict';
// Usage report: aggregate recorded profiles into a per-operation, per-field view of WHO depends
// on WHAT. For each operation and each field (read or sent), it lists the consumers that use it,
// so a provider can see which fields are widely depended on (change carefully) versus used by
// only one consumer (safer to change). Pure and vscode/CLI-free for easy testing.

function usageReport(profiles) {
  const consumers = [];
  const ops = {};
  for (const p of profiles || []) {
    const consumer = p.consumer;
    if (consumer && !consumers.includes(consumer)) consumers.push(consumer);
    for (const d of p.dependencies || []) {
      const op = d.op;
      ops[op] = ops[op] || {};
      const key = d.kind + ' ' + d.field;
      const entry = ops[op][key] || (ops[op][key] = { kind: d.kind, field: d.field, consumers: [] });
      if (consumer && !entry.consumers.includes(consumer)) entry.consumers.push(consumer);
    }
  }
  return { total: consumers.length, consumers, ops };
}

// Rows for one operation, sorted by how many consumers use the field (most-depended-on first).
function opRows(opFields) {
  return Object.values(opFields).sort((a, b) =>
    b.consumers.length - a.consumers.length ||
    a.kind.localeCompare(b.kind) ||
    String(a.field).localeCompare(String(b.field)));
}

function formatReport(report) {
  const lines = ['Usage report (' + report.total + ' consumer(s)):'];
  for (const op of Object.keys(report.ops)) {
    lines.push(op);
    for (const r of opRows(report.ops[op])) {
      lines.push('  ' + r.kind.padEnd(5) + String(r.field).padEnd(20) +
        r.consumers.length + '/' + report.total + '  ' + r.consumers.join(', '));
    }
  }
  return lines.join('\n');
}

module.exports = { usageReport, opRows, formatReport };
