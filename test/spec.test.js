'use strict';
const test = require('node:test'); const assert = require('node:assert');
const { resolveField } = require('../src/spec');
const spec = { components: { schemas: {
  NewPet: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, tag: { type: 'string' } } },
  Pet: { allOf: [{ $ref: '#/components/schemas/NewPet' }, { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } }] },
  Cat: { type: 'object', properties: { meow: { type: 'boolean' } } },
  Dog: { type: 'object', properties: { bark: { type: 'boolean' } } },
  Animal: { oneOf: [{ $ref: '#/components/schemas/Cat' }, { $ref: '#/components/schemas/Dog' }] },
} } };
const petRoot = { $ref: '#/components/schemas/Pet' };
const animalRoot = { $ref: '#/components/schemas/Animal' };

test('allOf: inherited field resolves', () => assert.strictEqual(resolveField(spec, petRoot, 'name').found, true));
test('allOf: own field resolves + required tracked', () => { const r = resolveField(spec, petRoot, 'id'); assert.strictEqual(r.found, true); assert.strictEqual(r.requiredInParent, true); });
test('allOf: missing field not found', () => assert.strictEqual(resolveField(spec, petRoot, 'nope').found, false));
test('oneOf: field in a branch resolves', () => assert.strictEqual(resolveField(spec, animalRoot, 'meow').found, true));
test('oneOf: field in other branch resolves', () => assert.strictEqual(resolveField(spec, animalRoot, 'bark').found, true));
