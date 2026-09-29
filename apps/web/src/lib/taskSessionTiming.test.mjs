import test from 'node:test';
import assert from 'node:assert/strict';
import { getTaskBlockRemainingSeconds, getTaskSessionElapsedSeconds } from './taskSessionTiming.js';

test('sessao contando deriva o tempo do instante recebido sem depender de ticks anteriores', () => {
  const session = { state: 'running', elapsedSeconds: 125, receivedAt: 1_000 };
  assert.equal(getTaskSessionElapsedSeconds(session, 6_999), 130);
  assert.equal(getTaskSessionElapsedSeconds(session, 66_999), 190);
});

test('sessao pausada preserva exatamente o acumulado', () => {
  const session = { state: 'paused', elapsedSeconds: 125, receivedAt: 1_000 };
  assert.equal(getTaskSessionElapsedSeconds(session, 999_999), 125);
});

test('bloco termina em zero e nunca fica negativo', () => {
  const session = { state: 'running', blockRemainingSeconds: 3, receivedAt: 1_000 };
  assert.equal(getTaskBlockRemainingSeconds(session, 3_000), 1);
  assert.equal(getTaskBlockRemainingSeconds(session, 20_000), 0);
});

test('bloco pausado não consome tempo', () => {
  const session = { state: 'paused', blockRemainingSeconds: 480, receivedAt: 1_000 };
  assert.equal(getTaskBlockRemainingSeconds(session, 999_999), 480);
});
