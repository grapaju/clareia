import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTodayGroups, filterTodayGroups, getOpenPlannedMinutes, getTaskNextActionPresentation, getTodayCapacityState, getTodayHighlight, getTodayPresentation, getTodaySummary, getTodayTaskSituation, getVisibleTodayTasks } from './todayViewLogic.js';

const referenceDate = new Date(2026, 8, 1, 12);

test('classifica cada tarefa aberta exatamente uma vez com precedencia canonica', () => {
  const tasks = [
    { id: 'waiting', status: 'aguardando_retorno', scheduledDate: '2026-08-20' },
    { id: 'overdue', status: 'pendente', scheduledDate: '2026-08-31' },
    { id: 'today', status: 'pendente', scheduledDate: '2026-09-01' },
    { id: 'future', status: 'pendente', scheduledDate: '2026-09-03' },
    { id: 'undated', status: 'pendente' },
    { id: 'routine', status: 'pendente', scheduledDate: '2026-08-31', recurrenceFrequency: 'Semanal' },
    { id: 'done', status: 'concluida', completedAt: '2026-09-01T10:00:00-03:00' },
    { id: 'archived', status: 'arquivada' },
  ];

  const result = buildTodayGroups(tasks, referenceDate);
  const groupedIds = Object.values(result.groups).flat().map((task) => task.id);

  assert.equal(result.openCount, 6);
  assert.equal(new Set(groupedIds).size, groupedIds.length);
  assert.deepEqual(result.groups.waiting.map(({ id }) => id), ['waiting']);
  assert.deepEqual(result.groups.overdue.map(({ id }) => id), ['overdue', 'routine']);
  assert.deepEqual(result.groups.routines.map(({ id }) => id), []);
  assert.deepEqual(result.completedToday.map(({ id }) => id), ['done']);
});

test('resumo e carga planejada usam os mesmos grupos abertos', () => {
  const { groups } = buildTodayGroups([
    { id: 'late', status: 'pendente', scheduledDate: '2026-08-31', timeEstimate: 20 },
    { id: 'today', status: 'pendente', scheduledDate: '2026-09-01', timeEstimate: 40 },
    { id: 'done', status: 'concluida', scheduledDate: '2026-09-01', timeEstimate: 90, completedAt: '2026-09-01' },
  ], referenceDate);

  assert.deepEqual(getTodaySummary(groups, 2, 1), {
    overdue: 1, today: 1, upcoming: 0, undated: 0, waiting: 1, routines: 0, guarded: 2,
  });
  assert.equal(getOpenPlannedMinutes(groups), 60);
});

test('total planejado soma abertas de hoje e atrasadas que participam do plano', () => {
  const { groups } = buildTodayGroups([
    { id: 'late', status: 'pendente', scheduledDate: '2026-08-31', timeEstimate: 105 },
    { id: 'today', status: 'pendente', scheduledDate: '2026-09-01', timeEstimate: 105 },
    { id: 'future', status: 'pendente', scheduledDate: '2026-09-05', timeEstimate: 105 },
    { id: 'waiting', status: 'aguardando_retorno', scheduledDate: '2026-09-01', timeEstimate: 90 },
    { id: 'done', status: 'concluida', scheduledDate: '2026-09-01', timeEstimate: 60, completedAt: '2026-09-01' },
  ], referenceDate);

  assert.equal(getOpenPlannedMinutes(groups), 210);
});

test('tarefa pontual não recebe classificação de rotina por título ou projeto', () => {
  assert.equal(getTodayTaskSituation({ title: 'Fazer alterações de rotina no site', project: 'Rotinas internas' }, referenceDate).routine, false);
  assert.equal(getTodayTaskSituation({ recurrenceFrequency: 'Rotina' }, referenceDate).routine, false);
  assert.equal(getTodayTaskSituation({ recurrenceFrequency: 'Semanal' }, referenceDate).routine, true);
  assert.equal(getTodayTaskSituation({ recurrenceRuleId: 'rule-1' }, referenceDate).routine, true);
});

test('capacidade distingue sobra, limite exato, quase cheia e excedida', () => {
  assert.deepEqual(getTodayCapacityState(80, 102), {
    differenceMinutes: -22,
    remainingMinutes: 22,
    isExactCapacity: false,
    isNearCapacity: false,
    isOverCapacity: false,
  });
  assert.deepEqual(getTodayCapacityState(102, 102), {
    differenceMinutes: 0,
    remainingMinutes: 0,
    isExactCapacity: true,
    isNearCapacity: false,
    isOverCapacity: false,
  });
  assert.deepEqual(getTodayCapacityState(95, 102), {
    differenceMinutes: -7,
    remainingMinutes: 7,
    isExactCapacity: false,
    isNearCapacity: true,
    isOverCapacity: false,
  });
  assert.deepEqual(getTodayCapacityState(105, 102), {
    differenceMinutes: 3,
    remainingMinutes: 0,
    isExactCapacity: false,
    isNearCapacity: false,
    isOverCapacity: true,
  });
});

test('situação atrasada não é rotulada como hoje à tarde', () => {
  assert.deepEqual(getTodayTaskSituation({ scheduledDate: '2026-08-31', scheduledPeriod: 'tarde' }, referenceDate), {
    label: 'Atrasada',
    routine: false,
  });
  assert.equal(getTodayTaskSituation({ scheduledDate: '2026-09-01', scheduledPeriod: 'tarde' }, referenceDate).label, 'Hoje à tarde');
});

test('filtro informa subconjunto sem alterar os grupos canônicos', () => {
  const { groups } = buildTodayGroups([
    { id: 'a', title: 'Enviar proposta', project: 'Expocentro', status: 'pendente' },
    { id: 'b', title: 'Revisar site', project: 'IDT-PR', status: 'pendente' },
  ], referenceDate);
  const filtered = filterTodayGroups(groups, { search: 'proposta', project: 'all' });

  assert.equal(filtered.undated.length, 1);
  assert.equal(groups.undated.length, 2);
});

test('rotina de hoje entra no fluxo normal e rotina futura fica fora da Hoje', () => {
  const { groups } = buildTodayGroups([
    { id: 'routine-today', status: 'pendente', scheduledDate: '2026-09-01', recurrenceFrequency: 'Semanal' },
    { id: 'routine-future', status: 'pendente', scheduledDate: '2026-09-21', recurrenceFrequency: 'Mensal' },
    { id: 'future-task', status: 'pendente', scheduledDate: '2026-09-03' },
  ], referenceDate);

  assert.deepEqual(groups.today.map(({ id }) => id), ['routine-today']);
  assert.deepEqual(getVisibleTodayTasks(groups).map(({ id }) => id), ['routine-today', 'future-task']);
});

test('lista simplificada exclui a recomendacao sem esconder outras tarefas', () => {
  const { groups } = buildTodayGroups([
    { id: 'recommended', status: 'pendente', scheduledDate: '2026-09-01' },
    { id: 'other', status: 'pendente' },
  ], referenceDate);

  assert.deepEqual(getVisibleTodayTasks(groups, 'recommended').map(({ id }) => id), ['other']);
});

test('lista simplificada ordena próximas tarefas por data', () => {
  const { groups } = buildTodayGroups([
    { id: 'later', status: 'pendente', scheduledDate: '2026-09-08' },
    { id: 'sooner', status: 'pendente', scheduledDate: '2026-09-03' },
  ], referenceDate);

  assert.deepEqual(getVisibleTodayTasks(groups).map(({ id }) => id), ['sooner', 'later']);
});

test('modo tranquilo com duas tarefas mostra somente o destaque e restaura a outra ao sair', () => {
  const tasks = [
    { id: 'first', status: 'pendente' },
    { id: 'second', status: 'pendente' },
  ];
  const highlight = getTodayHighlight(tasks, tasks[0]);

  assert.equal(getTodayPresentation(tasks, highlight, true).highlight.id, 'first');
  assert.deepEqual(getTodayPresentation(tasks, highlight, true).visibleTasks, []);
  assert.deepEqual(getTodayPresentation(tasks, highlight, false).visibleTasks.map(({ id }) => id), ['second']);
});

test('retomada tem precedencia sobre recomendacao sem duplicar a tarefa', () => {
  const tasks = [
    { id: 'recommended', status: 'pendente' },
    { id: 'started', status: 'em_andamento', microtarefas: [{ id: 'step', status: 'não iniciada' }] },
    { id: 'paused', status: 'pausada' },
  ];
  const highlight = getTodayHighlight(tasks, tasks[0]);
  const presentation = getTodayPresentation(tasks, highlight);

  assert.equal(highlight.reason, 'paused');
  assert.equal(highlight.task.id, 'paused');
  assert.deepEqual(presentation.visibleTasks.map(({ id }) => id), ['recommended', 'started']);
});

test('modo tranquilo trata zero, uma e dez tarefas sem expor a lista restante', () => {
  assert.deepEqual(getTodayPresentation([], getTodayHighlight([]), true), {
    highlight: null,
    visibleTasks: [],
  });

  const oneTask = [{ id: 'only', status: 'pendente' }];
  const oneHighlight = getTodayHighlight(oneTask, oneTask[0]);
  assert.equal(getTodayPresentation(oneTask, oneHighlight, true).highlight.id, 'only');

  const tenTasks = Array.from({ length: 10 }, (_, index) => ({ id: `task-${index}`, status: 'pendente' }));
  const tenHighlight = getTodayHighlight(tenTasks, tenTasks[4]);
  const calmPresentation = getTodayPresentation(tenTasks, tenHighlight, true);
  const normalPresentation = getTodayPresentation(tenTasks, tenHighlight, false);
  assert.equal(calmPresentation.highlight.id, 'task-4');
  assert.equal(calmPresentation.visibleTasks.length, 0);
  assert.equal(normalPresentation.visibleTasks.length, 9);
});

test('sessao ativa prevalece e trocar destaque devolve a tarefa anterior para a lista', () => {
  const tasks = [
    { id: 'first', status: 'em_andamento', microtarefas: [{ title: 'Continuar', completed: false }] },
    { id: 'second', status: 'pendente' },
    { id: 'active', status: 'em_andamento' },
  ];
  const activeHighlight = getTodayHighlight(tasks, tasks[1], { id: 'session', taskId: 'active' });
  assert.equal(activeHighlight.reason, 'active_session');
  assert.equal(activeHighlight.task.id, 'active');

  const suggestions = [
    { id: 'first', status: 'pendente' },
    { id: 'second', status: 'pendente' },
  ];
  const firstSuggestion = getTodayPresentation(suggestions, getTodayHighlight(suggestions, suggestions[0]));
  const secondSuggestion = getTodayPresentation(suggestions, getTodayHighlight(suggestions, suggestions[1]));
  assert.equal(firstSuggestion.visibleTasks.some(({ id }) => id === 'first'), false);
  assert.equal(secondSuggestion.visibleTasks.some(({ id }) => id === 'first'), true);
  assert.equal(secondSuggestion.visibleTasks.some(({ id }) => id === 'second'), false);
});

test('energia baixa prefere alternativa executável à retomada de alta energia', () => {
  const tasks = [
    { id: 'heavy', status: 'em_andamento', energiaNecessaria: 'alta' },
    { id: 'light', status: 'pendente', energiaNecessaria: 'baixa' },
  ];

  const highlight = getTodayHighlight(tasks, tasks[1], { id: 'session', taskId: 'heavy' }, { energia: 'baixa' });

  assert.equal(highlight.reason, 'recommended');
  assert.equal(highlight.task.id, 'light');
});

test('diferença pequena de energia mantém a continuidade da tarefa', () => {
  const tasks = [
    { id: 'heavy', status: 'em_andamento', energiaNecessaria: 'alta' },
    { id: 'medium', status: 'pendente', energiaNecessaria: 'média' },
  ];

  const highlight = getTodayHighlight(tasks, tasks[1], { id: 'session', taskId: 'heavy' }, { energia: 'média' });

  assert.equal(highlight.reason, 'active_session');
  assert.equal(highlight.task.id, 'heavy');
});

test('sem alternativa adequada preserva retomada mesmo com energia baixa', () => {
  const tasks = [{ id: 'heavy', status: 'em_andamento', energiaNecessaria: 'alta' }];

  const highlight = getTodayHighlight(tasks, null, { id: 'session', taskId: 'heavy' }, { energia: 'baixa' });

  assert.equal(highlight.reason, 'active_session');
  assert.equal(highlight.task.id, 'heavy');
});

test('próxima ação usa a microtarefa da própria tarefa e separa passo de bloco', () => {
  const presentation = getTaskNextActionPresentation({
    id: 'task-a',
    nextAction: 'Ação antiga (apenas 5 minutos)',
    timeEstimate: 105,
    microtarefas: [
      { id: 'done', taskId: 'task-a', title: 'Passo concluído', completed: true },
      { id: 'next', taskId: 'task-a', title: 'Separar os dados (apenas 5 minutos)', estimatedMinutes: 5, completed: false },
    ],
  }, 18);

  assert.equal(presentation.action, 'Separar os dados');
  assert.equal(presentation.actionMinutes, 5);
  assert.equal(presentation.blockMinutes, 18);
});

test('próxima ação não reaproveita microtarefa associada a outra tarefa', () => {
  const presentation = getTaskNextActionPresentation({
    id: 'task-a',
    nextAction: 'Abrir o pedido atual',
    nextActionMinutes: 5,
    microtarefas: [{ id: 'foreign', taskId: 'task-b', title: 'Passo de outra tarefa', completed: false }],
  });

  assert.equal(presentation.action, 'Abrir o pedido atual');
  assert.equal(presentation.actionMinutes, 5);
});

test('retomada não repete onde parou quando o texto já é o próximo passo', () => {
  const repeated = getTaskNextActionPresentation({
    nextAction: 'Separar nome, localização e descrição do empreendimento',
    pauseNote: 'Separar nome, localização e descrição do empreendimento',
  });
  const distinct = getTaskNextActionPresentation({
    nextAction: 'Separar nome, localização e descrição do empreendimento',
    pauseNote: 'A planilha está aberta na segunda aba',
  });

  assert.equal(repeated.pauseNote, '');
  assert.equal(distinct.pauseNote, 'A planilha está aberta na segunda aba');
});