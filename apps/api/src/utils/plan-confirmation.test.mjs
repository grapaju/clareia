import test from 'node:test';
import assert from 'node:assert/strict';
import { getInvalidPlanTaskIndexes } from './plan-confirmation.js';

test('identifica todas as tarefas sem titulo antes da gravacao em lote', () => {
  assert.deepEqual(getInvalidPlanTaskIndexes([
    { title: 'Publicar o site' },
    { title: '   ' },
    {},
  ]), [1, 2]);
});

test('aceita lote em que todas as tarefas possuem titulo', () => {
  assert.deepEqual(getInvalidPlanTaskIndexes([{ title: 'Cobrar retorno' }]), []);
});