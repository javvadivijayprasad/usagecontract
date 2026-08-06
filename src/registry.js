'use strict';
// Registry: profiles and provider specs are JSON files under a directory.
// "The broker is a bucket." Specs are versioned by ref (e.g. "orders@1.2.0") so
// can-i-deploy can resolve each consumer's baseline automatically.
const fs = require('fs'), path = require('path');
function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }
function specsDir(dir) { return path.join(dir, 'specs'); }
function profilesDir(dir) { return path.join(dir, 'profiles'); }
function refToFile(ref) { return String(ref).replace(/[^\w.@-]/g, '_') + '.json'; }

// --- profiles ---
function saveProfile(dir, profile) { ensure(dir); const f = path.join(dir, profile.consumer + '.profile.json'); fs.writeFileSync(f, JSON.stringify(profile, null, 2)); return f; }
function loadProfiles(dir) { if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir).filter(f => f.endsWith('.profile.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); }

// --- specs ---
function loadSpec(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function saveSpec(dir, ref, spec) { ensure(specsDir(dir)); const f = path.join(specsDir(dir), refToFile(ref)); fs.writeFileSync(f, JSON.stringify(spec, null, 2)); return f; }
function loadSpecByRef(dir, ref) { const f = path.join(specsDir(dir), refToFile(ref)); if (!fs.existsSync(f)) return null; return JSON.parse(fs.readFileSync(f, 'utf8')); }
function listSpecs(dir) { const d = specsDir(dir); if (!fs.existsSync(d)) return []; return fs.readdirSync(d).filter(f => f.endsWith('.json')); }

// --- sync helpers (folder registry) ---
function pushProfiles(fromDir, registryDir) { const dst = profilesDir(registryDir); ensure(dst); let n = 0; for (const p of loadProfiles(fromDir)) { saveProfile(dst, p); n++; } return n; }
function pullProfiles(registryDir, toDir) { const src = profilesDir(registryDir); ensure(toDir); let n = 0; for (const p of loadProfiles(src)) { saveProfile(toDir, p); n++; } return n; }

// Union two profiles' dependencies (for cross-run / CI-shard merging).
function mergeDeps(a, b) {
  const byKey = new Map();
  for (const d of (a || []).concat(b || [])) {
    const k = d.op + '|' + d.kind + '|' + d.field;
    const prev = byKey.get(k);
    byKey.set(k, prev ? Object.assign({}, prev, d) : d); // later run wins on annotations (enum/exhaustive/type)
  }
  return [...byKey.values()];
}
function mergeProfiles(a, b) {
  return { consumer: a.consumer || b.consumer, provider: a.provider || b.provider, specRef: a.specRef || b.specRef, dependencies: mergeDeps(a.dependencies, b.dependencies) };
}
function loadProfile(dir, consumer) { const f = path.join(dir, consumer + '.profile.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }

module.exports = { saveProfile, loadProfile, loadProfiles, loadSpec, saveSpec, loadSpecByRef, listSpecs, pushProfiles, pullProfiles, mergeProfiles, mergeDeps, profilesDir, specsDir };
