import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMicrotasks, suggestSmallerSteps } from './microtaskRules.js';

test('gera entre tres e seis microtarefas especificas', () => {
  const items = generateMicrotasks('Cobrança', 'Verificar e-mails do Koeddermann e enviar cobrança', 60);
  assert.ok(items.length >= 3 && items.length <= 6);
  assert.ok(items.every((item) => item.title && !item.title.includes('Executar atividade principal')));
});

test('prioriza a menor microtarefa incompleta como proximo passo', () => {
  const steps = suggestSmallerSteps({
    title: 'Atualizar site',
    microtarefas: [
      { title: 'Abrir a conversa do cliente', completed: true },
      { title: 'Separar as imagens recebidas', completed: false },
    ],
  });
  assert.deepEqual(steps, ['Separar as imagens recebidas']);
});

test('aceita tarefa nula enquanto o dialogo esta fechado', () => {
  const steps = suggestSmallerSteps(null);

  assert.equal(steps.length, 3);
  assert.ok(steps.every((step) => step.includes('esta tarefa')));
});