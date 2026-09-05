import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseFinanceEvent,
  signFinanceWebhook,
  verifyFinanceWebhook,
} from './finance-integration.js';

const now = Date.parse('2026-09-05T12:00:00.000Z');
const timestamp = String(Math.floor(now / 1000));
const event = {
  id: 'e1caee69-bbb0-43fc-a450-928e4860ac35',
  version: 1,
  type: 'finance.invoice.sent',
  occurredAt: '2026-09-05T11:59:00.000Z',
  source: 'fluxo-caixa',
  accountId: '926363be-fbe2-4352-892d-a22bef06bc36',
  data: {
    invoiceId: 'ab612d6d-8c0b-4127-bb9e-e6c9bd1bbb14',
    externalClientId: '68e760da-feb0-4fa6-b889-4938e8bc4796',
    clientName: 'IDT-PR',
    invoiceNumber: 'FAT-2026-0091',
    dueDate: '2026-09-10',
    totalAmount: '1500.00',
    paidAmount: '0.00',
    remainingAmount: '1500.00',
    status: 'pending',
    contextUrl: '/cobrancas/ab612d6d-8c0b-4127-bb9e-e6c9bd1bbb14',
  },
};

test('valida assinatura e contrato financeiro', () => {
  const rawBody = JSON.stringify(event);
  const signature = signFinanceWebhook('segredo-de-teste', timestamp, rawBody);

  assert.equal(verifyFinanceWebhook({ secret: 'segredo-de-teste', timestamp, signature, rawBody, now }), true);
  assert.deepEqual(parseFinanceEvent(rawBody), event);
});

test('rejeita corpo adulterado, timestamp expirado e campos extras', () => {
  const rawBody = JSON.stringify(event);
  const signature = signFinanceWebhook('segredo-de-teste', timestamp, rawBody);

  assert.equal(verifyFinanceWebhook({
    secret: 'segredo-de-teste',
    timestamp,
    signature,
    rawBody: `${rawBody} `,
    now,
  }), false);
  assert.equal(verifyFinanceWebhook({
    secret: 'segredo-de-teste',
    timestamp,
    signature,
    rawBody,
    now: now + 301_000,
  }), false);
  assert.throws(() => parseFinanceEvent(JSON.stringify({ ...event, unexpected: true })));
});