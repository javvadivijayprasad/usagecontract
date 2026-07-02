'use strict';
// A realistic walkthrough: one Orders API provider, two consumer apps that read
// DIFFERENT fields. usagecontract learns each consumer's real usage from its tests,
// then tells the provider exactly who a proposed change would break.
const http = require('http');
const { record, isBreaking } = require('../src/index');
const line = (s) => console.log(s);

// ---- The provider's OpenAPI spec (single source of truth) ----
const spec = {
  openapi: '3.0.0', info: { title: 'orders-api', version: '1.0.0' },
  paths: { '/orders/{id}': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } } } } } },
  components: { schemas: {
    Order: { type: 'object', required: ['id', 'status', 'total', 'items'], properties: {
      id: { type: 'string' }, status: { type: 'string' }, total: { type: 'number' },
      items: { type: 'array', items: { type: 'object', properties: { sku: { type: 'string' }, discount: { type: 'number' } } } } } } } },
};
const DATA = { id: 'o1', status: 'PENDING', total: 42.5, items: [{ sku: 'A1', discount: 0 }, { sku: 'B2', discount: 5 }] };

async function serve() { return new Promise(r => { const s = http.createServer((q, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(DATA)); }); s.listen(0, '127.0.0.1', () => r({ s, base: 'http://127.0.0.1:' + s.address().port })); }); }

// Two consumer apps with DIFFERENT real usage:
async function webApp(base) { const o = await (await fetch(base + '/orders/o1')).json(); const skus = o.items.map(i => i.sku); return [o.status, o.total, skus]; }      // reads status, total, items[].sku
async function mobileApp(base) { const o = await (await fetch(base + '/orders/o1')).json(); return [o.id, o.status]; }                                                     // reads id, status only

(async () => {
  const { s, base } = await serve();

  line('STEP 1 — Each consumer runs its NORMAL tests with recording on.\n         Nobody writes a contract. usagecontract watches what they read.\n');
  record.install(spec); record.start({ provider: 'orders-api', specRef: 'orders-api@1.0.0' }); await webApp(base);
  const web = record.stop('web-app');
  record.install(spec); record.start({ provider: 'orders-api', specRef: 'orders-api@1.0.0' }); await mobileApp(base);
  const mob = record.stop('mobile-app'); record.uninstall(); s.close();

  const show = (p) => '   ' + p.consumer.padEnd(11) + ' depends on: ' + p.dependencies.filter(d => d.kind === 'read').map(d => d.field).join(', ');
  line('   -> Derived usage profiles (the "contracts", auto-generated):');
  line(show(web)); line(show(mob));

  const clone = () => JSON.parse(JSON.stringify(spec));
  const gate = (name, cand) => {
    line('\n   $ usagecontract can-i-deploy   (' + name + ')');
    let broke = false;
    for (const p of [web, mob]) { const r = isBreaking(spec, cand, p); if (r.breaking) { broke = true; line('     BREAKS ' + p.consumer + ' -> ' + r.violations.map(v => v.field + ' (' + v.reason + ')').join(', ')); } }
    if (!broke) line('     SAFE for all consumers');
  };

  line('\nSTEP 2 — The provider proposes changes. usagecontract checks each against REAL usage.');
  const c1 = clone(); delete c1.components.schemas.Order.properties.items.items.properties.discount;
  gate('remove items[].discount  — a field NOBODY reads', c1);
  const c2 = clone(); c2.components.schemas.Order.properties.amount = c2.components.schemas.Order.properties.total; delete c2.components.schemas.Order.properties.total; c2.components.schemas.Order.required = ['id', 'status', 'amount', 'items'];
  gate('rename total -> amount   — web-app reads total, mobile does not', c2);

  line('\nSTEP 3 — Contrast: a schema-diff tool (no usage awareness) would flag BOTH');
  line('         changes as "breaking" for the WHOLE API, blocking safe deploys and');
  line('         never telling you it is only web-app that actually cares about total.');
})();
