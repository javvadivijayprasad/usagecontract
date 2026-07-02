'use strict';
// Minimal registry: profiles and specs are plain JSON files in a directory.
// "The broker is a bucket": no stateful server.
const fs = require('fs'), path = require('path');
function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }
function saveProfile(dir, profile) { ensure(dir); const f = path.join(dir, profile.consumer + '.profile.json'); fs.writeFileSync(f, JSON.stringify(profile, null, 2)); return f; }
function loadProfiles(dir) { if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir).filter(f => f.endsWith('.profile.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); }
function loadSpec(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
module.exports = { saveProfile, loadProfiles, loadSpec };
