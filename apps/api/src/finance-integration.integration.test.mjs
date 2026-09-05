import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import test from 'node:test';
import { startServer } from './main.js';
import { pool, runQuery } from './db/postgres.js';
import { signFinanceWebhook } from './utils/finance-integration.js';

async function api(baseUrl, path, { token = '', method = 'GET', body, headers = {} } = {}) {
  const response = await globalThis.fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    payload: response.status === 204 ? null : await response.json(),
  };
}

test('webhook financeiro cria registros uma unica vez e conclui no pagamento', async (context) => {
  const previousSecret = process.env.CLAREIA_FINANCE_WEBHOOK_SECRET;
  process.env.CLAREIA_FINANCE_WEBHOOK_SECRET = '00000000-0000-4000-8000-000000000001';
  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let userId = '';
  let otherUserId = '';
  let accountId = '';

  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (accountId) await runQuery('DELETE FROM finance_webhook_events WHERE external_account_id = $1', [accountId]);
    if (userId) await runQuery('DELETE FROM users WHERE id = $1', [userId]);
    if (otherUserId) await runQuery('DELETE FROM users WHERE id = $1', [otherUserId]);
    if (previousSecret === undefined) delete process.env.CLAREIA_FINANCE_WEBHOOK_SECRET;
    else process.env.CLAREIA_FINANCE_WEBHOOK_SECRET = previousSecret;
    await pool.end();
  });

  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const signup = await api(baseUrl, '/auth/signup', {
    method: 'POST',
    body: {
      name: 'Financeiro',
      email: `finance-${unique}@example.test`,
      password: 'Clareia-test-2026',
      passwordConfirm: 'Clareia-test-2026',
    },
  });
  assert.equal(signup.status, 201);
  userId = signup.payload.user.id;
  const token = signup.payload.token;
  accountId = randomUUID();
  const clientId = randomUUID();
  const invoiceId = randomUUID();

  const sendEvent = async (event) => {
    const rawBody = JSON.stringify(event);
    const timestamp = String(Math.floor(Date.now() / 1000));
    return api(baseUrl, '/webhooks/finance', {
      method: 'POST',
      body: rawBody,
      headers: {
        'x-clareia-timestamp': timestamp,
        'x-clareia-signature': signFinanceWebhook(
          process.env.CLAREIA_FINANCE_WEBHOOK_SECRET,
          timestamp,
          rawBody
        ),
      },
    });
  };

  const sentEvent = {
    id: randomUUID(),
    version: 1,
    type: 'finance.invoice.sent',
    occurredAt: new Date().toISOString(),
    source: 'fluxo-caixa',
    accountId,
    data: {
      invoiceId,
      externalClientId: clientId,
      clientName: 'Cliente Financeiro',
      invoiceNumber: 'FAT-001',
      dueDate: '2026-09-10',
      totalAmount: '1500.00',
      paidAmount: '0.00',
      remainingAmount: '1500.00',
      status: 'pending',
      contextUrl: `/cobrancas/${invoiceId}`,
    },
  };

  const project = await api(baseUrl, '/projects', {
    token, method: 'POST', body: { name: 'Cliente Financeiro' },
  });
  assert.equal(project.status, 201);

  assert.equal((await api(baseUrl, '/finance-integration')).status, 401);
  const malformedAccount = await api(baseUrl, '/finance-integration/account', {
    token, method: 'PUT', body: { externalAccountId: 'codigo-invalido' },
  });
  assert.equal(malformedAccount.status, 400);
  assert.match(malformedAccount.payload.message, /nao parece valido/i);
  assert.equal((await api(baseUrl, '/finance-integration/account', {
    token, method: 'PUT', body: { externalAccountId: process.env.CLAREIA_FINANCE_WEBHOOK_SECRET },
  })).status, 400);
  const unknownAccount = await api(baseUrl, '/finance-integration/account', {
    token, method: 'PUT', body: { externalAccountId: randomUUID() },
  });
  assert.equal(unknownAccount.status, 404);
  assert.match(unknownAccount.payload.message, /nao encontramos eventos/i);

  const beforeConnection = await sendEvent(sentEvent);
  assert.equal(beforeConnection.status, 202);
  assert.equal(beforeConnection.payload.status, 'pending_account_mapping');
  assert.equal((await api(baseUrl, '/finance-integration/account', {
    token, method: 'PUT', body: { externalAccountId: accountId },
  })).status, 200);

  const otherSignup = await api(baseUrl, '/auth/signup', {
    method: 'POST',
    body: {
      name: 'Outro Financeiro',
      email: `finance-other-${unique}@example.test`,
      password: 'Clareia-test-2026',
      passwordConfirm: 'Clareia-test-2026',
    },
  });
  assert.equal(otherSignup.status, 201);
  otherUserId = otherSignup.payload.user.id;
  const duplicateAccount = await api(baseUrl, '/finance-integration/account', {
    token: otherSignup.payload.token,
    method: 'PUT',
    body: { externalAccountId: accountId },
  });
  assert.equal(duplicateAccount.status, 409);
  const otherActivity = await api(baseUrl, '/finance-integration', { token: otherSignup.payload.token });
  assert.equal(otherActivity.payload.activity.length, 0);
  assert.equal((await api(baseUrl, `/finance-integration/clients/${clientId}`, {
    token: otherSignup.payload.token, method: 'PUT', body: { projectId: project.payload.item.id },
  })).status, 404);

  const pending = await api(baseUrl, '/finance-integration', { token });
  assert.equal(pending.payload.pending[0].externalClientId, clientId);
  assert.equal(pending.payload.activity[0].status, 'pending_client_mapping');
  assert.equal(pending.payload.summary.pendingClients, 1);

  const mapping = await api(baseUrl, `/finance-integration/clients/${clientId}`, {
    token, method: 'PUT', body: { projectId: project.payload.item.id },
  });
  assert.equal(mapping.status, 200);
  assert.equal(mapping.payload.eventsApplied, 1);

  const repeatedMapping = await api(baseUrl, `/finance-integration/clients/${clientId}`, {
    token, method: 'PUT', body: { projectId: project.payload.item.id },
  });
  assert.equal(repeatedMapping.status, 200);
  const integrationAfterRepeatedMapping = await api(baseUrl, '/finance-integration', { token });
  assert.equal(integrationAfterRepeatedMapping.payload.clients.length, 1);
  assert.equal(integrationAfterRepeatedMapping.payload.clients[0].clientName, 'Cliente Financeiro');
  assert.equal(integrationAfterRepeatedMapping.payload.clients[0].projectName, 'Cliente Financeiro');
  assert.equal(integrationAfterRepeatedMapping.payload.clients[0].projectId, project.payload.item.id);
  assert.equal(integrationAfterRepeatedMapping.payload.activity[0].result, 'Acompanhamento criado');
  assert.equal(integrationAfterRepeatedMapping.payload.account.externalAccountId, accountId);
  assert.doesNotMatch(JSON.stringify(integrationAfterRepeatedMapping.payload), /00000000-0000-4000-8000-000000000001/);

  const failedInvoiceId = randomUUID();
  const failedEvent = {
    ...sentEvent,
    id: randomUUID(),
    data: { ...sentEvent.data, invoiceId: failedInvoiceId, invoiceNumber: 'FAT-FAIL' },
  };
  await runQuery(
    `INSERT INTO app_records (id, collection_name, user_id, data)
     VALUES ($1, 'aguardandoretorno', $2, '{}'::jsonb)`,
    [`finance-wait-${failedInvoiceId}`, otherUserId]
  );
  const failed = await sendEvent(failedEvent);
  assert.equal(failed.status, 500);
  assert.equal(failed.payload.status, 'failed');
  const storedFailure = await runQuery(
    'SELECT status, error_message FROM finance_webhook_events WHERE event_id = $1',
    [failedEvent.id]
  );
  assert.equal(storedFailure.rows[0].status, 'failed');
  assert.equal(storedFailure.rows[0].error_message, 'Falha interna no processamento.');
  assert.doesNotMatch(storedFailure.rows[0].error_message, /00000000-0000-4000-8000-000000000001/);
  await runQuery('DELETE FROM app_records WHERE id = $1', [`finance-wait-${failedInvoiceId}`]);
  const retried = await sendEvent(failedEvent);
  assert.equal(retried.status, 200);
  assert.equal(retried.payload.status, 'applied');
  assert.equal(retried.payload.duplicate, true);
  const waitingAfterRetry = await api(baseUrl, '/records/aguardandoRetorno', { token });
  assert.equal(waitingAfterRetry.payload.items.filter((item) => item.financeInvoiceId === failedInvoiceId).length, 1);

  const duplicate = await sendEvent(sentEvent);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.payload.duplicate, true);
  const integrationAfterDuplicate = await api(baseUrl, '/finance-integration', { token });
  assert.equal(integrationAfterDuplicate.payload.activity.find((event) => event.eventId === sentEvent.id).result, 'Já processado');

  const tasks = await api(baseUrl, '/tasks', { token });
  const waiting = await api(baseUrl, '/records/aguardandoRetorno', { token });
  assert.equal(tasks.payload.items.filter((item) => item.financeInvoiceId === invoiceId).length, 0);
  assert.equal(waiting.payload.items.filter((item) => item.financeInvoiceId === invoiceId).length, 1);
  const openWaiting = waiting.payload.items.find((item) => item.financeInvoiceId === invoiceId);
  assert.equal(openWaiting.title, 'Aguardando pagamento — Cliente Financeiro');
  assert.equal(openWaiting.financeSource, 'fluxo-caixa');
  assert.equal(openWaiting.lastFinanceEventId, sentEvent.id);
  assert.equal(openWaiting.dueDate, sentEvent.data.dueDate);
  assert.equal(waiting.payload.items.filter((item) => item.status !== 'Concluido').length, 2);

  const overdueEvent = {
    ...sentEvent,
    id: randomUUID(),
    type: 'finance.invoice.overdue',
    occurredAt: new Date(Date.now() + 1000).toISOString(),
  };
  assert.equal((await sendEvent(overdueEvent)).status, 200);
  assert.equal((await sendEvent(overdueEvent)).payload.duplicate, true);
  const overdueTasks = await api(baseUrl, '/tasks', { token });
  assert.equal(overdueTasks.payload.items.filter((item) => item.financeInvoiceId === invoiceId).length, 1);
  assert.equal(overdueTasks.payload.items.find((item) => item.financeInvoiceId === invoiceId).title, 'Verificar pagamento — Cliente Financeiro');

  const paid = await sendEvent({
    ...sentEvent,
    id: randomUUID(),
    type: 'finance.invoice.paid',
    data: { ...sentEvent.data, status: 'paid', paidAmount: '1500.00', remainingAmount: '0.00' },
  });
  assert.equal(paid.status, 200);

  const completedTasks = await api(baseUrl, '/tasks', { token });
  const completedWaiting = await api(baseUrl, '/records/aguardandoRetorno', { token });
  assert.equal(completedTasks.payload.items.find((item) => item.financeInvoiceId === invoiceId).status, 'concluida');
  const resolvedWaiting = completedWaiting.payload.items.find((item) => item.financeInvoiceId === invoiceId);
  assert.equal(resolvedWaiting.status, 'Concluido');
  assert.equal(resolvedWaiting.resolutionNote, 'Resolvido automaticamente pelo FluxoCash');
  assert.ok(resolvedWaiting.resolvedAt);
  assert.equal(completedWaiting.payload.items.filter((item) => item.status !== 'Concluido').length, 1);

  const stale = await sendEvent({
    ...sentEvent,
    id: randomUUID(),
    occurredAt: '2025-12-31T12:00:00.000Z',
  });
  assert.equal(stale.status, 200);

  const tasksAfterStaleEvent = await api(baseUrl, '/tasks', { token });
  const waitingAfterStaleEvent = await api(baseUrl, '/records/aguardandoRetorno', { token });
  assert.equal(tasksAfterStaleEvent.payload.items.find((item) => item.financeInvoiceId === invoiceId).status, 'concluida');
  assert.equal(waitingAfterStaleEvent.payload.items.find((item) => item.financeInvoiceId === invoiceId).status, 'Concluido');

  const staleOverdue = await sendEvent({
    ...overdueEvent,
    id: randomUUID(),
    occurredAt: '2025-12-30T12:00:00.000Z',
  });
  assert.equal(staleOverdue.status, 200);
  const tasksAfterStaleOverdue = await api(baseUrl, '/tasks', { token });
  const waitingAfterStaleOverdue = await api(baseUrl, '/records/aguardandoRetorno', { token });
  assert.equal(tasksAfterStaleOverdue.payload.items.find((item) => item.financeInvoiceId === invoiceId).status, 'concluida');
  assert.equal(waitingAfterStaleOverdue.payload.items.find((item) => item.financeInvoiceId === invoiceId).status, 'Concluido');
});