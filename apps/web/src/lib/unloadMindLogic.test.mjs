import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPlanningPreferences, parseBrainDumpToTasks, parseUnloadMindToPlan } from './unloadMindLogic.js';

test('separa ações independentes de projetos diferentes', () => {
  const tasks = parseBrainDumpToTasks('acompanhar google ads da Corcril, cobrar fatura do IDT-PR');
  assert.equal(tasks.length, 2);
  assert.match(tasks[0].title, /acompanhar google ads/i);
  assert.match(tasks[1].title, /cobrar fatura/i);
});

test('separa duas ações relacionadas', () => {
  const tasks = parseBrainDumpToTasks('Revisar o calendário e publicar o site da Leone.');
  assert.equal(tasks.length, 2);
});

test('mantem complementos sem novo verbo na mesma tarefa', () => {
  const tasks = parseBrainDumpToTasks('Atualizar as fotos e o texto do site da InPACTA.');
  assert.equal(tasks.length, 1);
  assert.match(tasks[0].title, /fotos e o texto/i);
});

test('preserva origem de WhatsApp e associa InPACTA sem criar projeto genérico', () => {
  const plan = parseUnloadMindToPlan('O Marcio pediu no WhatsApp para atualizar as fotos e o texto do empreendimento no site da InPACTA até sexta.');
  const task = [...plan.maxima, ...plan.alta, ...plan.media, ...plan.podeEsperar, ...plan.acompanharDepois][0];

  assert.equal(task.project, 'InPACTA');
  assert.equal(task.sourceType, 'WhatsApp');
  assert.match(task.originalText, /Marcio pediu no WhatsApp/i);
  assert.equal(task.firstStep, 'Abrir a conversa do Marcio no WhatsApp e localizar o pedido');
});

test('preferências limitam passos existentes e definem bloco confortável', () => {
  const plan = parseUnloadMindToPlan('Atualizar o site da InPACTA.');
  const adapted = applyPlanningPreferences(plan, {
    comfortableDuration: 30,
    maxDailyPriorities: 3,
    microtaskDetail: 'poucos',
    availableTime: '2h',
    preferredPeriods: ['Noite'],
  });
  const task = [...adapted.maxima, ...adapted.alta, ...adapted.media, ...adapted.podeEsperar, ...adapted.acompanharDepois][0];

  assert.equal(task.timeEstimate, 105);
  assert.equal(task.focusBlockMinutes, 30);
  assert.equal(task.microtarefas.length, 3);
  assert.equal(task.scheduledPeriod, 'Noite');
  assert.equal(adapted.meta.preferencesApplied.microtaskDetail, 'poucos');
});