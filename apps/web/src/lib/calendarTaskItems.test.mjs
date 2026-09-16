import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTaskCalendarItems } from './calendarTaskItems.js';

const date = '2026-09-12';

test('tarefa ativa aparece no calendario', () => {
  const result = buildTaskCalendarItems([
    { id: 'active', title: 'Tarefa ativa', status: 'pendente', scheduledDate: date },
  ]);

  assert.deepEqual(result.taskItems.map((item) => item.sourceId), ['active']);
});

test('tarefa excluida ou arquivada nao aparece no calendario', () => {
  const result = buildTaskCalendarItems([
    {
      id: 'deleted',
      title: 'Excluída',
      status: 'pendente',
      scheduledDate: date,
      dueDate: date,
      recurrenceFrequency: 'Semanal',
      deletedAt: `${date}T10:00:00Z`,
    },
    { id: 'archived', title: 'Arquivada', status: 'arquivada', scheduledDate: date },
  ], [
    { id: 'deleted-focus', taskId: 'deleted', title: 'Foco excluído', startedAt: `${date}T10:00:00` },
  ]);

  assert.deepEqual(result.taskItems, []);
  assert.deepEqual(result.dueItems, []);
  assert.deepEqual(result.routineItems, []);
  assert.deepEqual(result.focusItems, []);
});

test('sessao orfa nao aparece e historico permanece inalterado', () => {
  const sessions = [
    { id: 'linked', taskId: 'active', title: 'Sessão válida', startedAt: `${date}T09:00:00` },
    { id: 'orphan', taskId: 'missing', title: 'Sessão órfã', startedAt: `${date}T10:00:00` },
    { id: 'independent', taskId: null, title: 'Bloco independente', startedAt: `${date}T11:00:00` },
  ];
  const result = buildTaskCalendarItems([
    { id: 'active', title: 'Tarefa ativa', status: 'pendente', scheduledDate: date },
  ], sessions);

  assert.deepEqual(result.focusItems.map((item) => item.sourceId), ['linked', 'independent']);
  assert.equal(sessions.length, 3);
});