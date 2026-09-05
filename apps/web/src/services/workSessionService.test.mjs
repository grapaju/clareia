import test from 'node:test';
import assert from 'node:assert/strict';

const values = new Map();
const localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
};

globalThis.window = { localStorage };
localStorage.setItem('clareia_auth_user', JSON.stringify({ id: 'timer-test-user' }));

let lockQueue = Promise.resolve();
let lockRequests = 0;
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    locks: {
      request(_name, callback) {
        lockRequests += 1;
        const result = lockQueue.then(callback);
        lockQueue = result.catch(() => undefined);
        return result;
      },
    },
  },
});

const service = await import('./workSessionService.js?main');

function resetStorage() {
  localStorage.clear();
  localStorage.setItem('clareia_auth_user', JSON.stringify({ id: 'timer-test-user' }));
  lockRequests = 0;
  lockQueue = Promise.resolve();
}

test('inicio duplo cria somente uma sessao', async () => {
  resetStorage();
  const [first, second] = await Promise.all([
    service.startTimerWorkSession({ taskId: 'task-1', projectId: 'Projeto' }),
    service.startTimerWorkSession({ taskId: 'task-1', projectId: 'Projeto' }),
  ]);

  assert.equal(first.id, second.id);
  assert.equal(service.listWorkSessions().length, 1);
});

test('recarga e retomada reutilizam a sessao ativa', async () => {
  resetStorage();
  const first = await service.startTimerWorkSession({ taskId: 'task-2' });
  const reloadedService = await import('./workSessionService.js?reload');
  const resumed = await reloadedService.startTimerWorkSession({ taskId: 'task-2' });

  assert.equal(resumed.id, first.id);
  assert.equal(reloadedService.listWorkSessions().length, 1);
});

test('duas abas usam o mesmo bloqueio e nao duplicam a sessao', async () => {
  resetStorage();
  const firstTab = await import('./workSessionService.js?tab-a');
  const secondTab = await import('./workSessionService.js?tab-b');
  const [first, second] = await Promise.all([
    firstTab.startTimerWorkSession({ taskId: 'task-3' }),
    secondTab.startTimerWorkSession({ taskId: 'task-3' }),
  ]);

  assert.equal(first.id, second.id);
  assert.equal(firstTab.listWorkSessions().length, 1);
  assert.equal(lockRequests, 2);
});

test('finalizar e iniciar novamente preserva a sessao anterior', async () => {
  resetStorage();
  const first = await service.startTimerWorkSession({ taskId: 'task-4' });
  service.finishWorkSession(first.id, { durationMinutes: 5 });
  const second = await service.startTimerWorkSession({ taskId: 'task-4' });

  assert.notEqual(second.id, first.id);
  assert.equal(service.listWorkSessions().length, 2);
});