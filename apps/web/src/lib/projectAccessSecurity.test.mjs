import test from 'node:test';
import assert from 'node:assert/strict';

import { withoutPlaintextPassword } from './projectAccessSecurity.js';

test('remove senha antes da persistencia de um novo acesso', () => {
  const result = withoutPlaintextPassword({ title: 'WordPress', password: 'nao-persistir', username: 'admin' });
  assert.deepEqual(result, { title: 'WordPress', username: 'admin' });
  assert.equal(Object.hasOwn(result, 'password'), false);
});

test('remove senha de uma atualizacao sem alterar outros campos', () => {
  const result = withoutPlaintextPassword({ password: 'nova-senha', notes: 'Senha no Bitwarden' });
  assert.deepEqual(result, { notes: 'Senha no Bitwarden' });
});