import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFinanceOperationalRecords } from './finance-integration.js';

const baseEvent = {
  id: 'e1caee69-bbb0-43fc-a450-928e4860ac35',
  version: 1,
  type: 'finance.invoice.partially_paid',
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
    paidAmount: '500.00',
    remainingAmount: '1000.00',
    status: 'partial',
    contextUrl: '/cobrancas/ab612d6d-8c0b-4127-bb9e-e6c9bd1bbb14',
  },
};

test('converte pagamento parcial em tarefa e acompanhamento vinculados ao projeto', () => {
  const records = buildFinanceOperationalRecords(baseEvent, {
    userId: 'user-1',
    projectName: 'IDT-PR',
  }, 'account-1');

  assert.equal(records.task.status, 'aguardando_retorno');
  assert.equal(records.task.project, 'IDT-PR');
  assert.match(records.task.nextAction, /R\$ 1000\.00/);
  assert.equal(records.waiting.status, 'Aguardando retorno');
  assert.equal(records.waiting.financeInvoiceId, baseEvent.data.invoiceId);
});

test('conclui tarefa e acompanhamento quando a fatura e paga', () => {
  const records = buildFinanceOperationalRecords({
    ...baseEvent,
    type: 'finance.invoice.paid',
    data: { ...baseEvent.data, status: 'paid', paidAmount: '1500.00', remainingAmount: '0.00' },
  }, { userId: 'user-1', projectName: 'IDT-PR' });

  assert.equal(records.task.status, 'concluida');
  assert.equal(records.task.completedAt, baseEvent.occurredAt);
  assert.equal(records.waiting.status, 'Concluido');
  assert.equal(records.waiting.nextFollowUpDate, '');
});