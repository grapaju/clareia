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
  process.env.CLAREIA_FINANCE_WEBHOOK_SECRET = 'segredo-financeiro-de-integracao';
  const server = await startServer(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let userId = '';
  let otherUserId = '';

  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
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
  const accountId = randomUUID();
  const clientId = randomUUID();
  const invoiceId = randomUUID();

  assert.equal((await api(baseUrl, '/projects', {
    token, method: 'POST', body: { name: 'Cliente Financeiro' },
  })).status, 201);
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

  const first = await sendEvent(sentEvent);
  assert.equal(first.status, 202);
  assert.equal(first.payload.status, 'pending_client_mapping');
  const pending = await api(baseUrl, '/finance-integration', { token });
  assert.equal(pending.payload.pending[0].externalClientId, clientId);

  const mapping = await api(baseUrl, `/finance-integration/clients/${clientId}`, {
    token, method: 'PUT', body: { projectName: 'Cliente Financeiro' },
  });
  assert.equal(mapping.status, 200);
  assert.equal(mapping.payload.eventsApplied, 1);

  const repeatedMapping = await api(baseUrl, `/finance-integration/clients/${clientId}`, {
    token, method: 'PUT', body: { projectName: 'Cliente Financeiro' },
  });
  assert.equal(repeatedMapping.status, 200);
  const integrationAfterRepeatedMapping = await api(baseUrl, '/finance-integration', { token });
  assert.equal(integrationAfterRepeatedMapping.payload.clients.length, 1);
  assert.equal(integrationAfterRepeatedMapping.payload.clients[0].clientName, 'Cliente Financeiro');
  assert.equal(integrationAfterRepeatedMapping.payload.clients[0].projectName, 'Cliente Financeiro');

  const duplicate = await sendEvent(sentEvent);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.payload.duplicate, true);

  const tasks = await api(baseUrl, '/tasks', { token });
  const waiting = await api(baseUrl, '/records/aguardandoRetorno', { token });
  assert.equal(tasks.payload.items.filter((item) => item.financeInvoiceId === invoiceId).length, 1);
  assert.equal(waiting.payload.items.filter((item) => item.financeInvoiceId === invoiceId).length, 1);
  assert.equal(tasks.payload.items.find((item) => item.financeInvoiceId === invoiceId).status, 'aguardando_retorno');

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
  assert.equal(completedWaiting.payload.items.find((item) => item.financeInvoiceId === invoiceId).status, 'Concluido');

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
});