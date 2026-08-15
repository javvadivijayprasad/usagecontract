'use strict';
// Minimal GraphQL query parser for usage extraction. This is NOT a full GraphQL
// implementation: it extracts the operation kind and name, the declared variables,
// and the selection-set field paths (dot notation). The insight is that a GraphQL
// query's selection set already declares exactly what a consumer depends on, so the
// selection set IS the usage profile (no response Proxy needed, unlike REST).
//
//   parseGraphQL('query Q($id:ID!){ order(id:$id){ id items { sku } } }')
//     => { type: 'query', name: 'Q', variables: ['id'],
//          fields: ['order', 'order.id', 'order.items', 'order.items.sku'] }

function tokenize(src) {
  const clean = src.replace(/#[^\n\r]*/g, ' '); // strip line comments
  const re = /\.\.\.|\$?[_A-Za-z][_0-9A-Za-z]*|"(?:[^"\\]|\\.)*"|[{}()[\]:!=@&|]/g;
  const out = [];
  let m;
  while ((m = re.exec(clean)) !== null) out.push(m[0]);
  return out; // commas, numbers and whitespace are simply not matched
}

function parseGraphQL(query) {
  if (typeof query !== 'string') throw new TypeError('query must be a string');
  const tokens = tokenize(query);
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const result = { type: 'query', name: null, variables: [], fields: [] };

  // Skip any leading fragment definitions: `fragment Name on Type { ... }`.
  while (peek() === 'fragment') {
    next(); next(); next(); next(); // fragment, Name, on, Type
    skipSelectionSet();
  }

  const head = peek();
  if (head === 'query' || head === 'mutation' || head === 'subscription') {
    result.type = next();
    if (peek() && /^[_A-Za-z]/.test(peek())) result.name = next();
    if (peek() === '(') result.variables = collectVars();
    skipDirectives();
    parseSelectionSet('');
  } else if (head === '{') {
    parseSelectionSet('');
  }

  if (!result.name && result.fields.length) result.name = result.fields[0].split('.')[0];
  return result;

  function collectVars() {
    const vars = [];
    let depth = 0;
    do {
      const t = next();
      if (t === '(') depth++;
      else if (t === ')') depth--;
      else if (t[0] === '$') vars.push(t.slice(1));
    } while (i < tokens.length && depth > 0);
    return [...new Set(vars)];
  }

  function skipParens() {
    let depth = 0;
    do {
      const t = next();
      if (t === '(') depth++;
      else if (t === ')') depth--;
    } while (i < tokens.length && depth > 0);
  }

  function skipDirectives() {
    while (peek() === '@') {
      next(); next(); // @, name
      if (peek() === '(') skipParens();
    }
  }

  function skipSelectionSet() {
    if (peek() !== '{') return;
    let depth = 0;
    do {
      const t = next();
      if (t === '{') depth++;
      else if (t === '}') depth--;
    } while (i < tokens.length && depth > 0);
  }

  function parseSelectionSet(prefix) {
    if (peek() !== '{') return;
    next(); // consume '{'
    while (i < tokens.length && peek() !== '}') {
      if (peek() === '...') {
        next();
        if (peek() === 'on') {
          next(); next();        // on, Type
          skipDirectives();
          parseSelectionSet(prefix); // inline fragment: same path level
        } else {
          next();                // fragment spread name (unresolved, skipped)
          skipDirectives();
        }
        continue;
      }
      let field = next();
      if (peek() === ':') { next(); field = next(); } // alias: use underlying field name
      if (peek() === '(') skipParens();
      skipDirectives();
      const path = prefix ? prefix + '.' + field : field;
      result.fields.push(path);
      if (peek() === '{') parseSelectionSet(path);
    }
    if (peek() === '}') next();
  }
}

module.exports = { parseGraphQL, tokenize };
