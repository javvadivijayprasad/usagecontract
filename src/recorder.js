'use strict';
// Traffic recorder. Integration points:
//   record.install(spec)            -> patches global fetch (Node 18+)
//   record.installAxios(ax, spec)   -> adds interceptors to an axios instance
//   record.installGot(got, spec)    -> returns a got instance with recording hooks
//   record.installUndici(u, spec)   -> returns an undici.request wrapper
// Each response body is wrapped in a deep read-tracking Proxy; a dependency is
// recorded only when a primitive field is read, or a query param is sent.
let TEMPLATES = [];
function configure(spec) {
  TEMPLATES = [];
  for (const [p, item] of Object.entries((spec && spec.paths) || {})) {
    for (const m of Object.keys(item)) {
      if (!['get', 'post', 'put', 'delete', 'patch'].includes(m)) continue;
      const re = '^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+') + '$';
      TEMPLATES.push({ op: m.toUpperCase() + ' ' + p, method: m.toUpperCase(), re: new RegExp(re) });
    }
  }
}
function match(method, pathname) { const h = TEMPLATES.find(t => t.method === method && t.re.test(pathname)); return h ? h.op : null; }
function inferType(v) { if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'; return typeof v; }
let ORIG = null; const state = { active: false, deps: new Map(), specRef: null, provider: null };
function key(o, k, f) { return o + '|' + k + '|' + f; }
function rec(op, kind, field, type) { if (!op) return; const k = key(op, kind, field); if (!state.deps.has(k)) state.deps.set(k, Object.assign({ op, kind, field }, type ? { type } : {})); }
function wrapEl(el, cp, op) { if (el !== null && typeof el === 'object') return wrap(el, cp, op); rec(op, 'read', cp, inferType(el)); return el; }
function wrap(v, path, op) { if (Array.isArray(v)) return arr(v, path, op); if (v !== null && typeof v === 'object') return obj(v, path, op); return v; }
function arr(a, path, op) { const c = path + '[]'; return new Proxy(a, { get(t, p, r) {
  if (p === Symbol.iterator) return function* () { for (let i = 0; i < t.length; i++) yield wrapEl(t[i], c, op); };
  if (p === 'map') return (cb) => t.map((e, i) => cb(wrapEl(e, c, op), i));
  if (p === 'forEach') return (cb) => t.forEach((e, i) => cb(wrapEl(e, c, op), i));
  if (p === 'filter') return (cb) => t.filter((e, i) => cb(wrapEl(e, c, op), i));
  if (typeof p === 'string' && /^\d+$/.test(p)) return wrapEl(t[p], c, op);
  return Reflect.get(t, p, r); } }); }
function obj(o, path, op) { return new Proxy(o, { get(t, p, r) {
  if (typeof p !== 'string' || !(p in t)) return Reflect.get(t, p, r);
  const cp = path ? path + '.' + p : p, val = t[p];
  if (val !== null && typeof val === 'object') return wrap(val, cp, op);
  rec(op, 'read', cp, inferType(val)); return val; } }); }
function noteSend(op, url, params) {
  if (!op) return;
  try { const u = new URL(url, 'http://localhost'); for (const n of u.searchParams.keys()) rec(op, 'send', n); } catch {}
  if (params && typeof params === 'object') for (const n of Object.keys(params)) rec(op, 'send', n);
}
function pathnameOf(url) { try { return new URL(typeof url === 'string' ? url : (url.href || String(url)), 'http://localhost').pathname; } catch { return ''; } }

function install(spec) { configure(spec); if (!ORIG) ORIG = globalThis.fetch; globalThis.fetch = async function (input, init) {
  const method = ((init && init.method) || 'GET').toUpperCase();
  const url = typeof input === 'string' ? input : input.url; const u = new URL(url, 'http://localhost');
  const op = state.active ? match(method, u.pathname) : null; if (op) noteSend(op, url);
  const resp = await ORIG(input, init); const text = await resp.text(); let json; try { json = JSON.parse(text); } catch { json = null; }
  return { status: resp.status, ok: resp.ok, headers: resp.headers, json: async () => (state.active && json !== null ? wrap(json, '', op) : json), text: async () => text };
}; }
function uninstall() { if (ORIG) globalThis.fetch = ORIG; }

function installAxios(axios, spec) {
  configure(spec);
  axios.interceptors.request.use((cfg) => {
    const base = cfg.baseURL || 'http://localhost';
    let pathname = cfg.url; try { pathname = new URL(cfg.url, base).pathname; } catch {}
    const op = match((cfg.method || 'get').toUpperCase(), pathname);
    cfg.__uc_op = op; if (state.active && op) noteSend(op, (cfg.baseURL || '') + cfg.url, cfg.params);
    return cfg;
  });
  axios.interceptors.response.use((resp) => {
    const op = resp.config && resp.config.__uc_op;
    if (state.active && op && resp.data !== null && typeof resp.data === 'object') resp.data = wrap(resp.data, '', op);
    return resp;
  });
  return axios;
}

// got: use responseType 'json' so the afterResponse body is a parsed object.
function installGot(got, spec) {
  configure(spec);
  return got.extend({
    hooks: {
      beforeRequest: [(options) => {
        const method = (options.method || 'GET').toUpperCase();
        const op = state.active ? match(method, pathnameOf(options.url)) : null;
        options.context = Object.assign({}, options.context, { __uc_op: op });
        if (op) { try { for (const n of options.url.searchParams.keys()) rec(op, 'send', n); } catch {} }
      }],
      afterResponse: [(response) => {
        const op = response.request && response.request.options && response.request.options.context && response.request.options.context.__uc_op;
        if (state.active && op && response.body !== null && typeof response.body === 'object') response.body = wrap(response.body, '', op);
        return response;
      }],
    },
  });
}

// undici: wrap the returned body.json() so reads are tracked.
function installUndici(undici, spec) {
  configure(spec);
  const orig = undici.request;
  return function request(url, opts) {
    const method = ((opts && opts.method) || 'GET').toUpperCase();
    const op = state.active ? match(method, pathnameOf(url)) : null;
    if (op) noteSend(op, typeof url === 'string' ? url : (url.href || ''), opts && opts.query);
    return orig.call(undici, url, opts).then((res) => {
      if (res && res.body && typeof res.body.json === 'function') {
        const oj = res.body.json.bind(res.body);
        res.body.json = async () => { const j = await oj(); return (state.active && op && j !== null && typeof j === 'object') ? wrap(j, '', op) : j; };
      }
      return res;
    });
  };
}

function startConsumer(meta) { state.active = true; state.deps = new Map(); state.specRef = (meta && meta.specRef) || null; state.provider = (meta && meta.provider) || null; }
function stopConsumer(consumer) { state.active = false; return { consumer, provider: state.provider, specRef: state.specRef, dependencies: [...state.deps.values()] }; }
module.exports = { install, uninstall, installAxios, installGot, installUndici, configure, startConsumer, stopConsumer, wrap };
