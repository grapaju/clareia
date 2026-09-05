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

test('Jornada Profissional persiste o dia do inPACTA com isolamento e auditoria', async (context) => {
  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userIds = [];

  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (userIds.length) await runQuery('DELETE FROM users WHERE id = ANY($1::uuid[])', [userIds]);
    await pool.end();
  });

  const signup = async (label) => {
    const response = await api(baseUrl, '/auth/signup', {
      method: 'POST',
      body: {
        name: label,
        email: `journey-${label}-${unique}@example.test`,
        password: 'Clareia-test-2026',
        passwordConfirm: 'Clareia-test-2026',
      },
    });
    assert.equal(response.status, 201);
    userIds.push(response.payload.user.id);
    return response.payload;
  };

  const userA = await signup('a');
  const userB = await signup('b');

  await context.test('configura projeto com 40 horas e preserva campos em patch parcial', async () => {
    const created = await api(baseUrl, '/projects', {
      token: userA.token,
      method: 'POST',
      body: {
        name: 'inPACTA', summary: 'Produto principal', projectType: 'Profissional',
        professionalTrackingEnabled: true, weeklyTargetMinutes: 2400,
        workDays: [1, 2, 3, 4, 5], timezone: 'America/Sao_Paulo',
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.payload.item.weeklyTargetMinutes, 2400);
    assert.deepEqual(created.payload.item.workDays, [1, 2, 3, 4, 5]);

    const patched = await api(baseUrl, '/projects/inPACTA', {
      token: userA.token, method: 'PATCH', body: { weeklyTargetMinutes: 2400 },
    });
    assert.equal(patched.payload.item.summary, 'Produto principal');
    assert.equal(patched.payload.item.projectType, 'Profissional');
    assert.equal(patched.payload.item.professionalTrackingEnabled, true);
  });

  let journeyId;
  await context.test('inicia uma unica jornada mesmo com clique duplo', async () => {
    const start = () => api(baseUrl, '/professional-journeys', {
      token: userA.token,
      method: 'POST',
      body: {
        projectName: 'inPACTA', startedAt: '2026-08-31T11:00:00.000Z',
        timezone: 'America/Sao_Paulo', idempotencyKey: `start-${unique}`,
      },
    });
    const [first, second] = await Promise.all([start(), start()]);
    assert.deepEqual([first.status, second.status].sort(), [200, 201]);
    assert.equal(first.payload.item.id, second.payload.item.id);
    journeyId = first.payload.item.id;
  });

  await context.test('impede duas jornadas abertas em projetos diferentes', async () => {
    const otherProject = await api(baseUrl, '/projects', {
      token: userA.token, method: 'POST',
      body: { name: 'Projeto paralelo', professionalTrackingEnabled: true },
    });
    assert.equal(otherProject.status, 201);
    const parallel = await api(baseUrl, '/professional-journeys', {
      token: userA.token, method: 'POST', body: { projectName: 'Projeto paralelo' },
    });
    assert.equal(parallel.status, 409);
    assert.match(parallel.payload.message, /Encerre a jornada de inPACTA/);
  });

  let taskId;
  await context.test('registra atividades e troca mantendo apenas uma ativa', async () => {
    const task = await api(baseUrl, '/tasks', {
      token: userA.token, method: 'POST',
      body: { title: 'Ajustar módulo', project: 'inPACTA', status: 'pendente' },
    });
    taskId = task.payload.item.id;
    const entries = [
      ['2026-08-31T11:05:00.000Z', 'Ajustar módulo', 'task', taskId],
      ['2026-08-31T12:30:00.000Z', 'Reunião de alinhamento', 'quick', null],
      ['2026-08-31T13:15:00.000Z', 'Corrigir cadastro', 'quick', null],
    ];
    for (const [startedAt, title, source, entryTaskId] of entries) {
      const response = await api(baseUrl, `/professional-journeys/${journeyId}/activities`, {
        token: userA.token, method: 'POST', body: { title, source, taskId: entryTaskId, startedAt },
      });
      assert.equal(response.status, 201);
    }
    const current = await api(baseUrl, '/professional-journeys/current', { token: userA.token });
    assert.equal(current.payload.activities.filter((item) => !item.endedAt).length, 1);
    assert.equal(current.payload.activities[0].durationMinutes, 85);
    assert.equal(current.payload.activities[1].durationMinutes, 45);
  });

  await context.test('pausa exclui uma hora e refresh recupera estado', async () => {
    const paused = await api(baseUrl, `/professional-journeys/${journeyId}/pause`, {
      token: userA.token, method: 'POST', body: { pausedAt: '2026-08-31T15:00:00.000Z', category: 'Almoço' },
    });
    assert.equal(paused.payload.item.status, 'paused');
    const refreshed = await api(baseUrl, '/professional-journeys/current?projectName=inPACTA', { token: userA.token });
    assert.equal(refreshed.payload.item.id, journeyId);
    assert.equal(refreshed.payload.item.status, 'paused');
    assert.equal(refreshed.payload.activities.filter((item) => !item.endedAt).length, 0);

    const resumed = await api(baseUrl, `/professional-journeys/${journeyId}/resume`, {
      token: userA.token, method: 'POST', body: { resumedAt: '2026-08-31T16:00:00.000Z' },
    });
    assert.equal(resumed.payload.item.status, 'active');
  });

  await context.test('atividade rapida e retorno a tarefa nao pausam a jornada', async () => {
    const quick = await api(baseUrl, `/professional-journeys/${journeyId}/activities`, {
      token: userA.token, method: 'POST',
      body: { title: 'Responder demanda urgente', source: 'quick', startedAt: '2026-08-31T16:05:00.000Z' },
    });
    assert.equal(quick.payload.item.source, 'quick');
    const resumedTask = await api(baseUrl, `/professional-journeys/${journeyId}/activities`, {
      token: userA.token, method: 'POST',
      body: { title: 'Ajustar módulo', source: 'task', taskId, startedAt: '2026-08-31T17:00:00.000Z' },
    });
    assert.equal(resumedTask.payload.item.taskId, taskId);
    const current = await api(baseUrl, '/professional-journeys/current', { token: userA.token });
    assert.equal(current.payload.item.status, 'active');
  });

  await context.test('encerramento calcula 8 horas liquidas e preserva onde parou', async () => {
    const closed = await api(baseUrl, `/professional-journeys/${journeyId}/close`, {
      token: userA.token, method: 'POST',
      body: { endedAt: '2026-08-31T20:00:00.000Z', closingNote: 'Retomar validação do cadastro' },
    });
    assert.equal(closed.payload.item.status, 'closed');

    const report = await api(baseUrl, '/professional-journeys?projectName=inPACTA&startDate=2026-08-31&endDate=2026-08-31', { token: userA.token });
    assert.equal(report.payload.journeys[0].grossMinutes, 540);
    assert.equal(report.payload.journeys[0].pauseMinutes, 60);
    assert.equal(report.payload.journeys[0].netMinutes, 480);
    assert.equal(report.payload.journeys[0].activityMinutes, 470);
    assert.equal(report.payload.journeys[0].unclassifiedMinutes, 10);
    assert.equal(report.payload.journeys[0].closingNote, 'Retomar validação do cadastro');
  });

  let manualActivityId;
  await context.test('aceita tempo manual em jornada encerrada', async () => {
    const manual = await api(baseUrl, `/professional-journeys/${journeyId}/activities`, {
      token: userA.token, method: 'POST',
      body: {
        title: 'Revisão manual', source: 'manual', category: 'Análise / planejamento',
        startedAt: '2026-08-31T11:00:00.000Z', endedAt: '2026-08-31T11:05:00.000Z',
        notes: 'Registro complementar', idempotencyKey: `manual-${unique}`,
      },
    });
    assert.equal(manual.status, 201);
    assert.equal(manual.payload.item.durationMinutes, 5);
    manualActivityId = manual.payload.item.id;
  });

  await context.test('correcao manual cria auditoria antes/depois', async () => {
    const corrected = await api(baseUrl, `/professional-journeys/activities/${manualActivityId}`, {
      token: userA.token, method: 'PATCH',
      body: { endedAt: '2026-08-31T11:04:00.000Z', notes: 'Duração corrigida', reason: 'Ajuste de um minuto' },
    });
    assert.equal(corrected.payload.item.durationMinutes, 4);
    assert.equal(corrected.payload.item.manuallyEdited, true);
    const report = await api(baseUrl, '/professional-journeys?projectName=inPACTA', { token: userA.token });
    const edit = report.payload.edits.find((item) => item.activityId === manualActivityId);
    assert.equal(edit.previousData.durationMinutes, 5);
    assert.equal(edit.correctedData.notes, 'Duração corrigida');
  });

  await context.test('outro usuario nao le nem altera a jornada', async () => {
    const currentForB = await api(baseUrl, '/professional-journeys/current', { token: userB.token });
    assert.equal(currentForB.payload.item, null);
    const reportForB = await api(baseUrl, '/professional-journeys', { token: userB.token });
    assert.deepEqual(reportForB.payload.journeys, []);
    const forbidden = await api(baseUrl, `/professional-journeys/${journeyId}/pause`, {
      token: userB.token, method: 'POST', body: {},
    });
    assert.equal(forbidden.status, 404);
  });
});