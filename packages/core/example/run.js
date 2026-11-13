'use strict';
// End-to-end demo: record a consumer's usage from a passing test, then gate a
// provider spec change with can-i-deploy and see the exact blast radius.
const http = require('http'), fs = require('fs'), path = require('path');
const { record } = require('../src/index');
const cli = require('../src/cli');

const spec = {
  openapi: '3.0.0', info: { title: 'orders', version: '1.0.0' },
  paths: { '/orders/{id}': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } } } } } } },
  components: { schemas: { Order: { type: 'object', required: ['id', 'status', 'total'], properties: { id: { type: 'string' }, status: { type: 'string' }, total: { type: 'number' }, note: { type: 'string' } } } } },
};

// consumer reads only status + total (not id, not note)
async function webApp(base) { const o = await (await fetch(base + '/orders/o1')).json(); return { s: o.status, t: o.total }; }

async function main() {
  const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ id: 'o1', status: 'PENDING', total: 9.5, note: 'x' })); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;

  record.install(spec);
  record.start({ provider: 'orders', specRef: 'orders@1.0.0' });
  await webApp(base);                                   // the app's normal test
  const dir = path.join(__dirname, 'profiles');
  const pf = record.flush('web-app', { dir });
  record.uninstall(); server.close();
  console.log('recorded profile ->', path.relative(process.cwd(), pf));
  console.log('   deps:', JSON.parse(fs.readFileSync(pf)).dependencies.map(d => d.field).join(', '));

  fs.writeFileSync(path.join(__dirname, 'base.json'), JSON.stringify(spec));
  const removeUsed = JSON.parse(JSON.stringify(spec)); delete removeUsed.components.schemas.Order.properties.status; removeUsed.components.schemas.Order.required = ['id', 'total'];
  fs.writeFileSync(path.join(__dirname, 'cand-breaking.json'), JSON.stringify(removeUsed));
  const removeUnused = JSON.parse(JSON.stringify(spec)); delete removeUnused.components.schemas.Order.properties.note;
  fs.writeFileSync(path.join(__dirname, 'cand-safe.json'), JSON.stringify(removeUnused));

  console.log('\n$ usagecontract can-i-deploy (removes UNUSED field "note")');
  cli.main(['can-i-deploy', '--base', path.join(__dirname, 'base.json'), '--candidate', path.join(__dirname, 'cand-safe.json'), '--profiles', dir]);
  console.log('\n$ usagecontract can-i-deploy (removes USED field "status")');
  cli.main(['can-i-deploy', '--base', path.join(__dirname, 'base.json'), '--candidate', path.join(__dirname, 'cand-breaking.json'), '--profiles', dir]);
}
main();
