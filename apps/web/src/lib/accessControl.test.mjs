import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivilegedUser } from './accessControl.js';

test('libera o Laboratorio somente para papeis privilegiados', () => {
  assert.equal(isPrivilegedUser({ role: 'user' }), false);
  assert.equal(isPrivilegedUser({ role: 'admin' }), true);
  assert.equal(isPrivilegedUser({ role: 'owner' }), true);
  assert.equal(isPrivilegedUser(null), false);
});