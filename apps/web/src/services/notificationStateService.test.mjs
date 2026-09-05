import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listReadNotificationIds,
  markNotificationRead,
  retainActiveNotificationReads,
} from './notificationStateService.js';

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
};

test('isola notificações lidas por usuário', () => {
  storage.clear();
  markNotificationRead('invoice-1:today', 'user-a');
  markNotificationRead('invoice-2:today', 'user-b');

  assert.deepEqual(listReadNotificationIds('user-a'), ['invoice-1:today']);
  assert.deepEqual(listReadNotificationIds('user-b'), ['invoice-2:today']);
});

test('mantém somente leituras de notificações ainda ativas', () => {
  storage.clear();
  markNotificationRead('active', 'user-a');
  markNotificationRead('resolved', 'user-a');

  assert.deepEqual(retainActiveNotificationReads(['active'], 'user-a'), ['active']);
});