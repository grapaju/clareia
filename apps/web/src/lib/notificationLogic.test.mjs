import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNotificationCenter,
  countUnreadAttention,
  differenceInLocalDays,
  getFinanceDuePresentation,
} from './notificationLogic.js';

const referenceDate = new Date(2026, 8, 5, 23, 30);
const financeItem = {
  id: 'finance-wait-invoice-1',
  financeSource: 'fluxo-caixa',
  financeInvoiceId: 'invoice-1',
  contactName: 'Grazi',
  totalAmount: '500.00',
  remainingAmount: '500.00',
  status: 'Aguardando retorno',
};

test('calcula datas de vencimento pelo dia local sem conversão UTC', () => {
  assert.equal(differenceInLocalDays('2026-09-05', referenceDate), 0);
  assert.deepEqual(getFinanceDuePresentation('2026-09-06', referenceDate), {
    label: 'Vence amanhã',
    formattedDate: '06/09/2026',
    state: 'tomorrow',
  });
  assert.equal(getFinanceDuePresentation('2026-09-03', referenceDate).label, 'Vencido há 2 dias');
});

test('vence amanhã e vence hoje geram avisos financeiros idempotentes', () => {
  const tomorrow = buildNotificationCenter({ waitingItems: [{ ...financeItem, dueDate: '2026-09-06' }], referenceDate });
  const today = buildNotificationCenter({ waitingItems: [{ ...financeItem, dueDate: '2026-09-05' }], referenceDate });
  assert.equal(tomorrow.attention[0].title, 'Pagamento de Grazi vence amanhã — R$ 500,00');
  assert.equal(today.attention[0].title, 'Pagamento de Grazi vence hoje — R$ 500,00');
  assert.equal(tomorrow.attention[0].id, 'invoice-1:finance-due-tomorrow:2026-09-06');
  assert.equal(tomorrow.attention[0].href, '/aguardando-retorno#finance-wait-invoice-1');
});

test('fatura vencida leva diretamente à tarefa operacional', () => {
  const center = buildNotificationCenter({ waitingItems: [{ ...financeItem, dueDate: '2026-09-03', lastFinanceEventType: 'finance.invoice.overdue' }], referenceDate });
  assert.equal(center.attention[0].title, 'Cobrança de Grazi está vencida — R$ 500,00');
  assert.equal(center.attention[0].href, '/?task=finance-task-invoice-1');
});

test('evento overdue prevalece mesmo quando o vencimento é hoje', () => {
  const center = buildNotificationCenter({
    waitingItems: [{ ...financeItem, dueDate: '2026-09-05', lastFinanceEventType: 'finance.invoice.overdue' }],
    referenceDate,
  });
  assert.match(center.attention[0].title, /^Cobrança de Grazi está vencida/);
});

test('fatura distante, guardado e acompanhamento sem prazo não aumentam badge', () => {
  const center = buildNotificationCenter({
    waitingItems: [
      { ...financeItem, dueDate: '2026-09-08' },
      { id: 'manual-1', status: 'Aguardando retorno', contactName: 'Márcio' },
    ],
    savedCount: 8,
    referenceDate,
  });
  assert.equal(center.attention.length, 0);
  assert.equal(center.tracking[0].title, '2 itens aguardando retorno');
  assert.equal(center.organizing[0].title, '8 itens guardados');
  assert.equal(countUnreadAttention(center), 0);
});

test('lembrete vencido gera atenção e item lido deixa o badge', () => {
  const center = buildNotificationCenter({
    waitingItems: [{ id: 'manual-1', status: 'Aguardando retorno', contactName: 'Márcio', reminderDate: '2026-09-05' }],
    referenceDate,
  });
  assert.equal(center.attention[0].title, 'Verificar retorno de Márcio');
  assert.equal(countUnreadAttention(center), 1);
  assert.equal(countUnreadAttention(center, [center.attention[0].id]), 0);
});

test('acompanhamento concluído remove qualquer aviso ativo', () => {
  const center = buildNotificationCenter({
    waitingItems: [{ ...financeItem, dueDate: '2026-09-05', status: 'Concluido' }],
    referenceDate,
  });
  assert.equal(center.attention.length, 0);
  assert.equal(center.tracking.length, 0);
});