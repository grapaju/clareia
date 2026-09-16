import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './main.js';
import { pool, runQuery } from './db/postgres.js';
import { parseUnloadMindToPlan } from '../../web/src/lib/unloadMindLogic.js';

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

function allTasks(plan) {
  return ['maxima', 'alta', 'media', 'podeEsperar', 'acompanharDepois'].flatMap((group) => plan[group] || []);
}

test('Descarregar a mente interpreta, revisa e persiste a tarefa Corcril completa', async (context) => {
  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const planId = `unload-mind-${unique}`;
  let userId = '';

  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (userId) await runQuery('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  const signup = await api(baseUrl, '/auth/signup', {
    method: 'POST',
    body: {
      name: 'Teste Descarregar',
      email: `unload-mind-${unique}@example.test`,
      password: 'Clareia-test-2026',
      passwordConfirm: 'Clareia-test-2026',
    },
  });
  assert.equal(signup.status, 201);
  userId = signup.payload.user.id;
  const token = signup.payload.token;

  assert.equal((await api(baseUrl, '/projects', {
    token,
    method: 'POST',
    body: { name: 'Corcril', projectType: 'Google Ads' },
  })).status, 201);

  const input = `Hoje — 16/09
Tarefa: Corcril — registrar situação atual da campanha Google Ads após correções de mensuração
Tempo estimado: 20 min
Descrição/notas: Compra [V4] está como conversão secundária; checkout continua principal; WhatsApp foi corrigido; orçamento R$120/dia e ROAS 23% permanecem sem alteração.
Microtarefas esperadas: registrar estado atual; anotar o que não deve ser alterado; salvar observações para comparação futura.`;
  const plan = parseUnloadMindToPlan(input, { projects: [{ name: 'Corcril', projectType: 'Google Ads' }] });
  const tasks = allTasks(plan);
  assert.equal(tasks.length, 1);

  await runQuery(
    `INSERT INTO app_records (id, collection_name, user_id, data)
     VALUES ($1, 'planosclareados', $2, $3::jsonb)`,
    [planId, userId, JSON.stringify({ conteudoOriginal: input, planoGerado: { ...plan, meta: { ...(plan.meta || {}), status: 'pending' } } })]
  );

  const confirmed = await api(baseUrl, '/plans/confirm', {
    token,
    method: 'POST',
    body: { planId, origin: 'plano-clareado', tasks },
  });
  assert.equal(confirmed.status, 201);
  assert.equal(confirmed.payload.createdCount, 1);

  const persisted = await runQuery(
    `SELECT data FROM tasks WHERE user_id = $1 AND data->>'sourcePlanId' = $2`,
    [userId, planId]
  );
  assert.equal(persisted.rowCount, 1);
  const task = persisted.rows[0].data;
  assert.equal(task.project, 'Corcril');
  assert.equal(task.scheduledDate, '2026-09-16');
  assert.equal(task.timeEstimate, 20);
  assert.equal(task.startTime, undefined);
  assert.match(task.notes, /Compra \[V4\]/);
  assert.equal(task.microtarefas.length, 3);
  assert.ok(task.microtarefas.every((item) => item.source === 'explicit'));
  assert.ok(task.constraints.some((item) => /orçamento/i.test(item)));
  assert.ok(task.constraints.some((item) => /ROAS/i.test(item)));
  assert.doesNotMatch(task.title, /alterar orçamento/i);
});