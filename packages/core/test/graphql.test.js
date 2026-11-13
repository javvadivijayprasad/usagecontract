'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { parseGraphQL } = require('../src/graphql');
const { record, parseGraphQL: parseFromIndex } = require('../src/index');

// ---- parser -------------------------------------------------------------

test('parses a named query with variables and nested selection', () => {
  const q = `query GetOrder($id: ID!, $full: Boolean = false) {
    order(id: $id) {
      id
      items {
        sku
        qty
      }
    }
  }`;
  const p = parseGraphQL(q);
  assert.strictEqual(p.type, 'query');
  assert.strictEqual(p.name, 'GetOrder');
  assert.deepStrictEqual(p.variables, ['id', 'full']);
  assert.deepStrictEqual(p.fields, ['order', 'order.id', 'order.items', 'order.items.sku', 'order.items.qty']);
});

test('anonymous query derives name from the first root field', () => {
  const p = parseGraphQL('{ me { id name } }');
  assert.strictEqual(p.type, 'query');
  assert.strictEqual(p.name, 'me');
  assert.deepStrictEqual(p.fields, ['me', 'me.id', 'me.name']);
});

test('parses a mutation', () => {
  const p = parseGraphQL('mutation { createOrder(input: {sku: "x"}) { id } }');
  assert.strictEqual(p.type, 'mutation');
  assert.strictEqual(p.name, 'createOrder');
  assert.deepStrictEqual(p.fields, ['createOrder', 'createOrder.id']);
});

test('resolves aliases to the underlying field name', () => {
  const p = parseGraphQL('{ primary: order { ref: id } }');
  assert.deepStrictEqual(p.fields, ['order', 'order.id']);
});

test('descends into inline fragments at the same path level', () => {
  const p = parseGraphQL('{ node { ... on Order { id total } } }');
  assert.deepStrictEqual(p.fields, ['node', 'node.id', 'node.total']);
});

test('skips fragment spreads and leading fragment definitions', () => {
  const q = `fragment Money on Order { total }
    query { order { id ...Money } }`;
  const p = parseGraphQL(q);
  assert.strictEqual(p.type, 'query');
  assert.deepStrictEqual(p.fields, ['order', 'order.id']);
});

test('skips directives with and without arguments', () => {
  const q = `query Q($x: Boolean!) @live {
    a @include(if: $x) { b }
    c
  }`;
  const p = parseGraphQL(q);
  assert.strictEqual(p.name, 'Q');
  assert.deepStrictEqual(p.variables, ['x']);
  assert.deepStrictEqual(p.fields, ['a', 'a.b', 'c']);
});

test('ignores comments', () => {
  const p = parseGraphQL('{ # a comment\n order { id } }');
  assert.deepStrictEqual(p.fields, ['order', 'order.id']);
});

test('anonymous query with variables has null-derived name from first field', () => {
  const p = parseGraphQL('query ($id: ID!) { order(id: $id) { id } }');
  assert.deepStrictEqual(p.variables, ['id']);
  assert.strictEqual(p.name, 'order');
});

test('empty document yields empty result', () => {
  const p = parseGraphQL('fragment F on T { a }');
  assert.strictEqual(p.name, null);
  assert.deepStrictEqual(p.fields, []);
});

test('throws on non-string input', () => {
  assert.throws(() => parseGraphQL({}), TypeError);
});

test('parseGraphQL is re-exported from the index', () => {
  assert.strictEqual(parseFromIndex, parseGraphQL);
});

// ---- record.graphql (direct body inspection) ---------------------------

test('record.graphql records reads from selection set and sends from variables', () => {
  record.start({ provider: 'gql', specRef: 'gql@1' });
  const op = record.graphql({ query: 'query GetOrder($id: ID!){ order(id:$id){ id status } }', variables: { id: 'o1' } });
  const p = record.stop('gql-consumer');
  assert.strictEqual(op, 'QUERY GetOrder');
  const reads = p.dependencies.filter(d => d.kind === 'read' && d.op === op).map(d => d.field).sort();
  const sends = p.dependencies.filter(d => d.kind === 'send' && d.op === op).map(d => d.field).sort();
  assert.deepStrictEqual(reads, ['order', 'order.id', 'order.status']);
  assert.deepStrictEqual(sends, ['id']);
});

test('record.graphql accepts a JSON string body and falls back to declared variables', () => {
  record.start({ provider: 'gql', specRef: 'gql@1' });
  const op = record.graphql(JSON.stringify({ query: 'query Q($id: ID!){ order(id:$id){ id } }' }));
  const p = record.stop('gql-consumer');
  const sends = p.dependencies.filter(d => d.kind === 'send').map(d => d.field);
  assert.strictEqual(op, 'QUERY Q');
  assert.deepStrictEqual(sends, ['id']); // declared variable used, no runtime variables object
});

test('record.graphql derives an op for anonymous empty queries', () => {
  record.start({ provider: 'gql', specRef: 'gql@1' });
  const op = record.graphql({ query: 'query { }' });
  record.stop('gql-consumer');
  assert.strictEqual(op, 'QUERY anonymous');
});

test('record.graphql returns null for non-graphql or malformed bodies', () => {
  record.start({ provider: 'gql', specRef: 'gql@1' });
  assert.strictEqual(record.graphql({ notAQuery: true }), null);
  assert.strictEqual(record.graphql('{ not json'), null);
  assert.strictEqual(record.graphql(null), null);
  record.stop('gql-consumer');
});

test('record.graphql returns null when the recorder is not active', () => {
  assert.strictEqual(record.graphql({ query: '{ a }' }), null);
});

// ---- fetch integration --------------------------------------------------

test('a GraphQL POST through patched fetch is recorded from its body', async () => {
  const DATA = { data: { order: { id: 'o1', items: [{ sku: 'A1' }] } } };
  const s = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify(DATA)); });
  await new Promise((res) => s.listen(0, '127.0.0.1', res));
  const base = 'http://127.0.0.1:' + s.address().port;

  record.install({ openapi: '3.0.0', info: { title: 't', version: '1' }, paths: {}, components: { schemas: {} } });
  record.start({ provider: 'gql', specRef: 'gql@1' });
  const resp = await fetch(base + '/graphql', {
    method: 'POST',
    body: JSON.stringify({ query: 'query GetOrder($id: ID!){ order(id:$id){ id items { sku } } }', variables: { id: 'o1' } }),
  });
  const body = await resp.json();
  assert.strictEqual(body.data.order.id, 'o1'); // response passes through unwrapped
  const p = record.stop('gql-fetch-consumer');
  record.uninstall();
  s.close();

  const reads = p.dependencies.filter(d => d.kind === 'read').map(d => d.field).sort();
  const sends = p.dependencies.filter(d => d.kind === 'send').map(d => d.field).sort();
  assert.deepStrictEqual(reads, ['order', 'order.id', 'order.items', 'order.items.sku']);
  assert.deepStrictEqual(sends, ['id']);
});
