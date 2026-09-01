import test from 'node:test';
import assert from 'node:assert/strict';
import { getUserScopedStorageKey, readUserScopedJson, writeUserScopedJson } from './userScopedStorage.js';

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
};

function authenticate(userId) {
  storage.set('clareia_auth_user', JSON.stringify({ id: userId }));
}

test('isola dados ao alternar A para B e voltar para A', () => {
  storage.clear();
  authenticate('user-a');
  writeUserScopedJson('personal-data', [{ id: 'a' }]);

  authenticate('user-b');
  assert.deepEqual(readUserScopedJson('personal-data', []), []);
  writeUserScopedJson('personal-data', [{ id: 'b' }]);

  authenticate('user-a');
  assert.deepEqual(readUserScopedJson('personal-data', []), [{ id: 'a' }]);
  assert.deepEqual(JSON.parse(storage.get(getUserScopedStorageKey('personal-data', 'user-b'))), [{ id: 'b' }]);
});

test('preserva chave legada sem atribui-la ao usuário atual', () => {
  storage.clear();
  storage.set('personal-data', JSON.stringify([{ id: 'legacy-without-owner' }]));
  authenticate('user-a');

  assert.deepEqual(readUserScopedJson('personal-data', []), []);
  assert.equal(storage.has('personal-data'), true);
});

test('não lê nem grava dados pessoais sem usuário autenticado', () => {
  storage.clear();
  assert.equal(writeUserScopedJson('personal-data', [{ id: 'anonymous' }]), false);
  assert.deepEqual(readUserScopedJson('personal-data', []), []);
});