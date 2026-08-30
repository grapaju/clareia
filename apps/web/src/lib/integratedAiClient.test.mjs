import test from 'node:test';
import assert from 'node:assert/strict';
import { integratedAiClient } from './integratedAiClient.js';

test('aceita resposta 204 sem tentar interpretar JSON', async (context) => {
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  let jsonCalled = false;

  context.after(() => {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  });

  globalThis.localStorage = { getItem: () => null };
  globalThis.window = {
    fetch: async () => ({
      ok: true,
      status: 204,
      json: async () => {
        jsonCalled = true;
        throw new SyntaxError('unexpected end of data');
      },
    }),
  };

  const result = await integratedAiClient.fetch('/projects/teste', { method: 'DELETE' });

  assert.equal(result, null);
  assert.equal(jsonCalled, false);
});