import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './main.js';
import { pool, runQuery } from './db/postgres.js';

async function api(baseUrl, path, { token = '', method = 'GET', body } = {}) {
  const response = await globalThis.fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = response.status === 204 ? null : await response.json();
  return { status: response.status, payload };
}

test('isola projetos, tarefas, sessões, notas e Guardados entre usuários A e B', async (context) => {
  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const password = 'Clareia-test-2026';
  const createdUserIds = [];

  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (createdUserIds.length) await runQuery('DELETE FROM users WHERE id = ANY($1::uuid[])', [createdUserIds]);
    await pool.end();
  });

  const signup = async (label) => {
    const result = await api(baseUrl, '/auth/signup', {
      method: 'POST',
      body: { email: `isolation-${label}-${unique}@example.test`, password, passwordConfirm: password, name: label },
    });
    assert.equal(result.status, 201);
    createdUserIds.push(result.payload.user.id);
    return result.payload;
  };

  const userA = await signup('a');
  const userB = await signup('b');
  const projectA = await api(baseUrl, '/projects', { token: userA.token, method: 'POST', body: { name: 'Projeto A' } });
  assert.equal(projectA.status, 201);

  const taskAResponse = await api(baseUrl, '/tasks', {
    token: userA.token,
    method: 'POST',
    body: { title: 'Tarefa privada A', project: 'Projeto A', userId: userB.user.id, status: 'pendente' },
  });
  assert.equal(taskAResponse.status, 201);
  assert.equal(taskAResponse.payload.item.userId, userA.user.id);
  const taskA = taskAResponse.payload.item;

  assert.equal((await api(baseUrl, `/tasks/${taskA.id}/notes`, { token: userA.token, method: 'POST', body: { content: 'Nota A' } })).status, 201);
  assert.equal((await api(baseUrl, `/tasks/${taskA.id}/focus-sessions`, { token: userA.token, method: 'POST', body: { durationMinutes: 12, idempotencyKey: `focus-${unique}` } })).status, 201);
  assert.equal((await api(baseUrl, '/records/guardados', { token: userA.token, method: 'POST', body: { id: `guardado-${unique}`, content: 'Guardado A', userId: userB.user.id } })).status, 201);

  const tasksForB = await api(baseUrl, '/tasks', { token: userB.token });
  const projectsForB = await api(baseUrl, '/projects', { token: userB.token });
  const savedForB = await api(baseUrl, '/records/guardados', { token: userB.token });
  assert.deepEqual(tasksForB.payload.items, []);
  assert.deepEqual(projectsForB.payload.items, []);
  assert.deepEqual(savedForB.payload.items, []);

  assert.equal((await api(baseUrl, `/tasks/${taskA.id}/notes`, { token: userB.token })).status, 404);
  assert.equal((await api(baseUrl, `/tasks/${taskA.id}/focus-sessions`, { token: userB.token })).status, 404);
  assert.equal((await api(baseUrl, `/tasks/${taskA.id}/notes`, { token: userB.token, method: 'POST', body: { content: 'Invasão' } })).status, 404);
  assert.equal((await api(baseUrl, `/tasks/${taskA.id}`, { token: userB.token, method: 'PATCH', body: { title: 'Alterada por B' } })).status, 404);
  assert.equal((await api(baseUrl, `/tasks/${taskA.id}`, { token: userB.token, method: 'DELETE' })).status, 404);

  const taskB = await api(baseUrl, '/tasks', { token: userB.token, method: 'POST', body: { title: 'Tarefa privada B', status: 'pendente' } });
  assert.equal(taskB.status, 201);
  const tasksForAAgain = await api(baseUrl, '/tasks', { token: userA.token });
  assert.deepEqual(tasksForAAgain.payload.items.map((item) => item.id), [taskA.id]);
  assert.equal((await api(baseUrl, `/tasks/${taskA.id}/notes`, { token: userA.token })).payload.items.length, 1);
  assert.equal((await api(baseUrl, `/tasks/${taskA.id}/focus-sessions`, { token: userA.token })).payload.items.length, 1);
});