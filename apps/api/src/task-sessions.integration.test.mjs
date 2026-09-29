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
  return { status: response.status, payload: await response.json() };
}

test('sessao de tarefa e unica, precisa e idempotente entre transicoes', async (context) => {
  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let userId = '';

  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (userId) await runQuery('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  const signup = await api(baseUrl, '/auth/signup', {
    method: 'POST',
    body: {
      email: `task-session-${unique}@example.test`,
      password: 'Clareia-test-2026',
      passwordConfirm: 'Clareia-test-2026',
      name: 'Sessão Teste',
    },
  });
  assert.equal(signup.status, 201);
  const { token, user } = signup.payload;
  userId = user.id;

  const createTask = async (title) => {
    const response = await api(baseUrl, '/tasks', {
      token,
      method: 'POST',
      body: { title, status: 'pendente' },
    });
    assert.equal(response.status, 201);
    return response.payload.item;
  };

  const firstTask = await createTask('Primeira tarefa');
  const secondTask = await createTask('Segunda tarefa');
  const concurrentStarts = await Promise.all([
    api(baseUrl, '/tasks/session/start', { token, method: 'POST', body: { taskId: firstTask.id, blockDurationSeconds: 1200 } }),
    api(baseUrl, '/tasks/session/start', { token, method: 'POST', body: { taskId: firstTask.id, blockDurationSeconds: 1200 } }),
  ]);
  assert.deepEqual(concurrentStarts.map((result) => result.status), [201, 201]);
  assert.equal(concurrentStarts[0].payload.session.id, concurrentStarts[1].payload.session.id);

  await runQuery(
    `UPDATE active_task_sessions
     SET running_since = now() - interval '2 minutes',
         block_running_since = now() - interval '2 minutes'
     WHERE user_id = $1`,
    [userId]
  );

  const paused = await api(baseUrl, '/tasks/session/pause', { token, method: 'POST' });
  assert.equal(paused.status, 200);
  assert.equal(paused.payload.session.state, 'paused');
  assert.ok(paused.payload.session.elapsedSeconds >= 120);
  const pausedAgain = await api(baseUrl, '/tasks/session/pause', { token, method: 'POST' });
  assert.equal(pausedAgain.payload.session.elapsedSeconds, paused.payload.session.elapsedSeconds);

  const resumed = await api(baseUrl, '/tasks/session/resume', { token, method: 'POST' });
  assert.equal(resumed.payload.session.state, 'running');
  assert.equal(resumed.payload.session.id, paused.payload.session.id);

  const rejectedSwitch = await api(baseUrl, '/tasks/session/start', {
    token,
    method: 'POST',
    body: { taskId: secondTask.id },
  });
  assert.equal(rejectedSwitch.status, 409);
  assert.equal(rejectedSwitch.payload.session.taskId, firstTask.id);

  const confirmedSwitch = await api(baseUrl, '/tasks/session/start', {
    token,
    method: 'POST',
    body: { taskId: secondTask.id, confirmSwitch: true },
  });
  assert.equal(confirmedSwitch.status, 201);
  assert.equal(confirmedSwitch.payload.previousSession.taskId, firstTask.id);
  assert.equal(confirmedSwitch.payload.session.taskId, secondTask.id);

  const completed = await api(baseUrl, `/tasks/${secondTask.id}/complete`, {
    token,
    method: 'POST',
    body: { session: { objective: 'Validar conclusão' } },
  });
  assert.equal(completed.status, 200);
  assert.equal(completed.payload.item.status, 'concluida');
  assert.equal(completed.payload.taskSession.taskId, secondTask.id);
  assert.equal((await api(baseUrl, '/tasks/session/current', { token })).payload.session, null);

  const rows = await runQuery('SELECT COUNT(*)::int AS count FROM active_task_sessions WHERE user_id = $1', [userId]);
  assert.equal(rows.rows[0].count, 0);
});
