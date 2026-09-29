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

test('perfil do projeto influencia a geração sem substituir o objeto da tarefa', () => {
  const plan = parseUnloadMindToPlan('IDTPR - revisar layout mobile', {
    projects: [
      { name: 'IDTPR', projectType: 'Site', summary: 'WordPress, Elementor, eventos e manutenção' },
    ],
  });
  const task = [...plan.maxima, ...plan.alta, ...plan.media, ...plan.podeEsperar, ...plan.acompanharDepois][0];
  const steps = task.microtarefas.map((item) => item.descricao);

  assert.equal(task.project, 'IDTPR');
  assert.equal(task.firstStep, 'Abrir a página em largura mobile');
  assert.ok(steps.some((step) => /Elementor.*CSS/i.test(step)));
  assert.ok(steps.every((step) => !/material relacionado|critério de aprovação/i.test(step)));
});

test('não transforma contexto concluído em ação futura', () => {
  const plan = parseUnloadMindToPlan('Depois de corrigir o formulário, revisar os cadastros de hoje.');
  const task = [...plan.maxima, ...plan.alta, ...plan.media, ...plan.podeEsperar, ...plan.acompanharDepois][0];
  const steps = task.microtarefas.map((item) => item.descricao);

  assert.doesNotMatch(task.title, /corrigir o formulário/i);
  assert.ok(steps.every((step) => !/corrigir o formulário/i.test(step)));
  assert.match(task.notes, /Contexto já concluído/i);
});

test('não define origem por palavra isolada', () => {
  const plan = parseUnloadMindToPlan('Analisar WhatsApp e ligações da campanha.');
  const task = [...plan.maxima, ...plan.alta, ...plan.media, ...plan.podeEsperar, ...plan.acompanharDepois][0];

  assert.equal(task.sourceType, null);
});

test('mantém origem quando houver evidência explícita', () => {
  const plan = parseUnloadMindToPlan('O cliente pediu pelo WhatsApp para alterar o banner da Home.');
  const task = [...plan.maxima, ...plan.alta, ...plan.media, ...plan.podeEsperar, ...plan.acompanharDepois][0];

  assert.equal(task.sourceType, 'WhatsApp');
});

test('cobre lista explícita de verificações ao gerar passos', () => {
  const plan = parseUnloadMindToPlan('Revisar campanha. Conferir custo, cliques, leads, grupos de anúncios e orçamento.');
  const task = [...plan.maxima, ...plan.alta, ...plan.media, ...plan.podeEsperar, ...plan.acompanharDepois][0];
  const steps = task.microtarefas.map((item) => item.descricao).join(' | ');

  assert.match(steps, /custo/i);
  assert.match(steps, /cliques/i);
  assert.match(steps, /leads/i);
  assert.match(steps, /grupos de anúncios/i);
  assert.match(steps, /orçamento/i);
});

test('preserva restrição negativa sem criar ação contrária', () => {
  const plan = parseUnloadMindToPlan('Revisar o relatório, mas não enviar ainda.');
  const task = [...plan.maxima, ...plan.alta, ...plan.media, ...plan.podeEsperar, ...plan.acompanharDepois][0];
  const steps = task.microtarefas.map((item) => item.descricao).join(' | ');

  assert.ok(task.constraints.some((item) => /não enviar ainda/i.test(item)));
  assert.doesNotMatch(steps, /enviar (?:o )?relat[oó]rio/i);
});

test('interpreta corretamente o caso real Corcril', () => {
  const input = 'Dia 03/10 revisar campanha Google Ads da Corcril após correção da mensuração, 45 minutos. Analisar somente dados desde 29/09: WhatsApp, chamadas, custo por contato, canais da PMax, grupos de recursos e concentração de gasto no YouTube. Não alterar a campanha antes da análise.';
  const plan = parseUnloadMindToPlan(input, {
    projects: [{ id: 'corcril', name: 'Corcril', projectType: 'Google Ads' }],
  });
  const task = [...plan.maxima, ...plan.alta, ...plan.media, ...plan.podeEsperar, ...plan.acompanharDepois][0];
  const steps = task.microtarefas.map((item) => item.descricao).join(' | ');

  assert.equal(task.project, 'Corcril');
  assert.equal(task.taskType, 'Google Ads');
  assert.equal(task.timeEstimate, 45);
  assert.equal(task.scheduledDate, '2026-10-03');
  assert.equal(task.sourceType, null);
  assert.match(task.notes, /Contexto já concluído: correção da mensuração/i);
  assert.match(task.firstStep, /per[ií]odo a partir de 29\/09/i);
  assert.match(steps, /WhatsApp/i);
  assert.match(steps, /chamadas/i);
  assert.match(steps, /custo por contato/i);
  assert.match(steps, /PMax/i);
  assert.match(steps, /grupos de recursos/i);
  assert.match(steps, /YouTube/i);
  assert.ok(task.constraints.some((item) => /não alterar a campanha antes da análise/i.test(item)));
});

test('higieniza analysisItems removendo metadados e contexto', () => {
  const input = 'Dia 03/10 revisar campanha Google Ads da Corcril após correção da mensuração, 45 minutos. Analisar somente dados desde 29/09: WhatsApp, chamadas, custo por contato, canais da PMax, grupos de recursos e concentração de gasto no YouTube. Não alterar a campanha antes da análise.';
  const plan = parseUnloadMindToPlan(input, {
    projects: [{ id: 'corcril', name: 'Corcril', projectType: 'Google Ads' }],
  });
  const task = [...plan.maxima, ...plan.alta, ...plan.media, ...plan.podeEsperar, ...plan.acompanharDepois][0];

  assert.deepEqual(task.analysisItems, [
    'WhatsApp',
    'chamadas',
    'custo por contato',
    'canais da PMax',
    'grupos de recursos',
    'concentração de gasto no YouTube',
  ]);
  assert.ok(task.analysisItems.every((item) => !/\b45\s*min|minutos?\b/i.test(item)));
  assert.ok(task.analysisItems.every((item) => !/corre[çc][aã]o da mensura[çc][aã]o/i.test(item)));
  assert.ok(task.analysisItems.every((item) => !/somente dados desde|desde 29\/09:/i.test(item)));
});

test('escopo antes de dois pontos não contamina o primeiro item da lista', () => {
  const plan = parseUnloadMindToPlan('Revisar campanha. Analisar somente dados desde 29/09: WhatsApp, chamadas, custo por contato.');
  const task = [...plan.maxima, ...plan.alta, ...plan.media, ...plan.podeEsperar, ...plan.acompanharDepois][0];

  assert.equal(task.analysisItems[0], 'WhatsApp');
  assert.ok(task.analysisItems.every((item) => !/somente dados desde|desde 29\/09:/i.test(item)));
});

test('preserva todos os requisitos explícitos nos passos mesmo com lista longa', () => {
  const plan = parseUnloadMindToPlan('Revisar campanha. Conferir custo, cliques, leads, grupos de anúncios, orçamento, impressões e CTR.');
  const task = [...plan.maxima, ...plan.alta, ...plan.media, ...plan.podeEsperar, ...plan.acompanharDepois][0];
  const steps = task.microtarefas.map((item) => item.descricao).join(' | ');

  assert.match(steps, /custo/i);
  assert.match(steps, /cliques/i);
  assert.match(steps, /leads/i);
  assert.match(steps, /grupos de anúncios/i);
  assert.match(steps, /orçamento/i);
  assert.match(steps, /impressões/i);
  assert.match(steps, /ctr/i);
});

test('mantém source semântico nulo e preserva origem técnica interna separada', () => {
  const plan = parseUnloadMindToPlan('Analisar WhatsApp e ligações da campanha.');
  const task = [...plan.maxima, ...plan.alta, ...plan.media, ...plan.podeEsperar, ...plan.acompanharDepois][0];

  assert.equal(task.sourceType, null);
  assert.equal(task.internalSource, 'mind-dump');
});

test('analysisItems final para a revisão contém exatamente os seis requisitos do caso Corcril', () => {
  const input = 'Dia 03/10 revisar campanha Google Ads da Corcril após correção da mensuração, 45 minutos. Analisar somente dados desde 29/09: WhatsApp, chamadas, custo por contato, canais da PMax, grupos de recursos e concentração de gasto no YouTube. Não alterar a campanha antes da análise.';
  const draft = applyPlanningPreferences(parseUnloadMindToPlan(input, {
    projects: [{ id: 'corcril', name: 'Corcril', projectType: 'Google Ads' }],
  }), {});
  const task = [...draft.maxima, ...draft.alta, ...draft.media, ...draft.podeEsperar, ...draft.acompanharDepois][0];

  assert.deepEqual(task.analysisItems, [
    'WhatsApp',
    'chamadas',
    'custo por contato',
    'canais da PMax',
    'grupos de recursos',
    'concentração de gasto no YouTube',
  ]);
});

test('seis requisitos explícitos permanecem representados nos passos finais da revisão', () => {
  const input = 'Dia 03/10 revisar campanha Google Ads da Corcril após correção da mensuração, 45 minutos. Analisar somente dados desde 29/09: WhatsApp, chamadas, custo por contato, canais da PMax, grupos de recursos e concentração de gasto no YouTube. Não alterar a campanha antes da análise.';
  const draft = applyPlanningPreferences(parseUnloadMindToPlan(input, {
    projects: [{ id: 'corcril', name: 'Corcril', projectType: 'Google Ads' }],
  }), {});
  const task = [...draft.maxima, ...draft.alta, ...draft.media, ...draft.podeEsperar, ...draft.acompanharDepois][0];
  const steps = task.microtarefas.map((item) => item.descricao).join(' | ');

  assert.match(steps, /whatsapp/i);
  assert.match(steps, /chamadas/i);
  assert.match(steps, /custo por contato/i);
  assert.match(steps, /canais da pmax/i);
  assert.match(steps, /grupos de recursos/i);
  assert.match(steps, /concentra[çc][aã]o de gasto no youtube/i);
});