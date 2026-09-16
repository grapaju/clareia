import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDailyCapacity,
  canTaskFitInDay,
  replanOverdueScheduledTasks,
  schedulePendingTasks,
  selectTasksWithinDailyCapacity,
} from './planningEngine.js';

const preferences = { workDays: [1, 2, 3, 4, 5], allowWeekendTasks: false, sundayIsRestDay: true };
const startDate = new Date('2026-09-14T12:00:00');
const task = (id, extra = {}) => ({ id, title: id, status: 'pendente', timeEstimate: 40, project: 'Cliente', ...extra });
const plan = (tasks, options = {}) => schedulePendingTasks(tasks, { startDate, availableMinutes: 120, preferences, ...options });

test('agenda tarefa sem prazo em um dia com capacidade', () => {
  assert.equal(plan([task('a')]).tasks[0].scheduledDate, '2026-09-14');
});

test('varias tarefas nao excedem a capacidade diaria', () => {
  const result = plan([task('a'), task('b'), task('c')]);
  const totals = Object.groupBy(result.tasks, (item) => item.scheduledDate);
  assert.ok(Object.values(totals).every((items) => items.reduce((sum, item) => sum + item.timeEstimate, 0) <= 102));
});

test('tarefa com dueDate e planejada antes do prazo', () => {
  const result = plan([task('a', { dueDate: '2026-09-16' })]);
  assert.ok(result.tasks[0].scheduledDate <= result.tasks[0].dueDate);
});

test('tarefa sem espaco antes do prazo gera risco amigavel', () => {
  const result = plan([task('a', { dueDate: '2026-09-14', timeEstimate: 200 })]);
  assert.equal(result.tasks[0].deadlineRisk, true);
  assert.match(result.tasks[0].deadlineRiskMessage, /tempo disponível pode não ser suficiente/i);
});

test('alterar scheduledDate nao altera dueDate', () => {
  const original = task('a', { dueDate: '2026-09-18', scheduledDate: '2026-09-14', manualSchedule: true });
  const moved = { ...original, scheduledDate: '2026-09-16' };
  assert.equal(moved.dueDate, '2026-09-18');
});

test('tarefa aberta vencida e replanejada', () => {
  const result = replanOverdueScheduledTasks([task('a', { scheduledDate: '2026-09-11' })], { startDate, availableMinutes: 120, preferences });
  assert.equal(result.tasks[0].scheduledDate, '2026-09-14');
});

test('tarefa concluida nao e replanejada', () => {
  const result = replanOverdueScheduledTasks([task('a', { status: 'concluida', scheduledDate: '2026-09-11' })], { startDate, availableMinutes: 120, preferences });
  assert.equal(result.updatedTasks.length, 0);
});

test('aguardando retorno nao ocupa replanejamento comum', () => {
  const result = replanOverdueScheduledTasks([task('a', { status: 'aguardando_retorno', scheduledDate: '2026-09-11' })], { startDate, availableMinutes: 120, preferences });
  assert.equal(result.updatedTasks.length, 0);
});

test('tarefa fixa nao e movida', () => {
  const result = replanOverdueScheduledTasks([task('a', { fixedTime: true, scheduledDate: '2026-09-11' })], { startDate, availableMinutes: 120, preferences });
  assert.equal(result.updatedTasks.length, 0);
});

test('tarefa grande distribui microtarefas sem duplicar a tarefa', () => {
  const result = plan([task('a', {
    timeEstimate: 240,
    microtarefas: [
      { id: 'm1', estimatedMinutes: 80, completed: false },
      { id: 'm2', estimatedMinutes: 80, completed: false },
      { id: 'm3', estimatedMinutes: 80, completed: false },
    ],
  })]);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].planningUsesMicrotasks, true);
  assert.equal(new Set(result.tasks[0].microtarefas.map((item) => item.scheduledDate)).size, 3);
});

test('tarefas profissionais nao sao colocadas no fim de semana', () => {
  const friday = new Date('2026-09-18T12:00:00');
  const result = schedulePendingTasks([task('a'), task('b'), task('c')], { startDate: friday, availableMinutes: 60, preferences });
  assert.deepEqual(result.tasks.map((item) => item.scheduledDate), ['2026-09-18', '2026-09-21', '2026-09-22']);
});

test('capacidade reserva margem de seguranca central', () => {
  assert.deepEqual(calculateDailyCapacity({ availableMinutes: 240, plannedMinutes: 120, fixedMinutes: 30 }), {
    availableMinutes: 240,
    capacityMinutes: 204,
    plannedMinutes: 120,
    fixedMinutes: 30,
    remainingMinutes: 54,
    isOverCapacity: false,
  });
  assert.equal(canTaskFitInDay({ taskMinutes: 55, availableMinutes: 240, plannedMinutes: 120, fixedMinutes: 30 }), false);
});

test('replanejamento e idempotente no mesmo dia', () => {
  const first = replanOverdueScheduledTasks([task('a', { scheduledDate: '2026-09-11' })], { startDate, availableMinutes: 120, preferences });
  const second = replanOverdueScheduledTasks(first.tasks, { startDate, availableMinutes: 120, preferences });
  assert.equal(second.updatedTasks.length, 0);
  assert.equal(second.tasks.length, 1);
});

test('tarefas criadas juntas sao distribuidas por dias', () => {
  const result = plan(Array.from({ length: 8 }, (_, index) => task(`t${index}`, { timeEstimate: index === 6 ? 25 : index === 4 ? 45 : 40 })));
  assert.ok(new Set(result.tasks.map((item) => item.scheduledDate)).size >= 4);
});

test('compromissos fixos reduzem a capacidade sem serem movidos', () => {
  const result = plan([task('a')], { commitments: [{ id: 'c1', date: '2026-09-14', estimatedMinutes: 90 }] });
  assert.equal(result.tasks[0].scheduledDate, '2026-09-15');
});

test('tarefas pessoais sem prazo ficam atras de tarefas de cliente', () => {
  const result = plan([
    task('pessoal', { project: 'Pessoal', taskType: 'Pessoal', timeEstimate: 60 }),
    task('cliente', { project: 'Corcril', priority: 'alta', timeEstimate: 60 }),
  ]);
  assert.equal(result.tasks.find((item) => item.id === 'cliente').scheduledDate, '2026-09-14');
  assert.equal(result.tasks.find((item) => item.id === 'pessoal').scheduledDate, '2026-09-15');
});

test('selecao da tela Hoje mostra apenas o que cabe', () => {
  const result = selectTasksWithinDailyCapacity([
    task('a', { timeEstimate: 40 }),
    task('b', { timeEstimate: 40 }),
    task('c', { timeEstimate: 30 }),
  ], { availableMinutes: 120 });
  assert.deepEqual(result.tasks.map((item) => item.id), ['c', 'a']);
  assert.equal(result.plannedMinutes, 70);
  assert.equal(result.capacity.capacityMinutes, 102);
});

test('tarefa excluida nao entra no planejamento automatico', () => {
  const result = plan([task('deleted', { deletedAt: '2026-09-12T10:00:00Z' })]);
  assert.equal(result.updatedTasks.length, 0);
  assert.equal(result.tasks[0].scheduledDate, undefined);
});

test('tarefa excluida nao entra no replanejamento', () => {
  const result = replanOverdueScheduledTasks([
    task('deleted', { isDeleted: true, scheduledDate: '2026-09-11' }),
  ], { startDate, availableMinutes: 120, preferences });
  assert.equal(result.updatedTasks.length, 0);
  assert.equal(result.tasks[0].scheduledDate, '2026-09-11');
});