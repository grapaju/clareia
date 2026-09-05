import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWaitingReturnInput } from './waitingReturnLogic.js';

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