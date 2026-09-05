import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countOpenWaitingReturns,
  formatFinanceAmount,
  formatFinanceDueDate,
  getWaitingReturnActions,
  isFinanceWaitingReturn,
  isOpenWaitingReturn,
  normalizeWaitingReturnInput,
} from './waitingReturnLogic.js';

test('cria acompanhamento simples com título automático', () => {
  assert.deepEqual(normalizeWaitingReturnInput({
    waitingFor: '  Márcio confirmar as alterações do site  ',
    contactName: 'Márcio',
  }), {
    title: 'Márcio confirmar as alterações do site',
    project: '',
    contactName: 'Márcio',
    waitingFor: 'Márcio confirmar as alterações do site',
    lastContactDate: '',
    reminderDate: '',
    nextFollowUp: '',
    nextFollowUpDate: '',
    observations: '',
    status: 'Aguardando retorno',
  });
});

test('exige somente o texto do que está sendo aguardado', () => {
  assert.equal(normalizeWaitingReturnInput({ contactName: 'Márcio' }), null);
  assert.ok(normalizeWaitingReturnInput({ waitingFor: 'Receber aprovação' }));
});

test('acompanhamento manual preserva concluir e reabrir', () => {
  assert.deepEqual(getWaitingReturnActions({ status: 'Aguardando retorno' }), {
    showComplete: true,
    showReopen: false,
    showDelete: true,
  });
  assert.deepEqual(getWaitingReturnActions({ status: 'Concluido' }), {
    showComplete: false,
    showReopen: true,
    showDelete: true,
  });
});

test('acompanhamento financeiro não oferece ações manuais de status', () => {
  const item = {
    financeSource: 'fluxo-caixa',
    financeInvoiceId: 'invoice-1',
    status: 'Aguardando retorno',
  };
  assert.equal(isFinanceWaitingReturn(item), true);
  assert.deepEqual(getWaitingReturnActions(item), {
    showComplete: false,
    showReopen: false,
    showDelete: false,
  });
});

test('contador considera apenas acompanhamentos realmente abertos', () => {
  assert.equal(isOpenWaitingReturn({ status: 'Aguardando retorno' }), true);
  assert.equal(isOpenWaitingReturn({ status: 'Concluido' }), false);
  assert.equal(countOpenWaitingReturns([
    { status: 'Aguardando retorno' },
    { status: 'Concluido' },
    { financeSource: 'fluxo-caixa', financeInvoiceId: 'invoice-1', status: 'Aguardando retorno' },
  ]), 2);
  assert.equal(countOpenWaitingReturns([
    { status: 'Aguardando retorno' },
    { status: 'Concluido' },
    { financeSource: 'fluxo-caixa', financeInvoiceId: 'invoice-1', status: 'Concluido' },
  ]), 1);
});

test('formata valores e vencimento do acompanhamento financeiro', () => {
  assert.equal(formatFinanceAmount('500.00'), 'R$ 500,00');
  assert.equal(formatFinanceDueDate('2026-09-05'), '05/09/2026');
});