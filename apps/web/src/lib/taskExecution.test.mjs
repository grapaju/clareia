import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTaskMicrotaskProgress,
  filterOperationalTaskReferences,
  isTaskActionableStatus,
  isTaskArchivedStatus,
  isTaskCompletedStatus,
  isTaskDeleted,
  isTaskOperational,
  isTaskOpenStatus,
  normalizeTaskStatus,
  removeTaskFromOperationalState,
  TASK_STATUS,
  upsertMicrotaskCompletion,
} from './taskExecution.js';

test('normaliza status legados para o ciclo canonico da tarefa', () => {
  for (const status of ['Concluída', 'concluida', 'concluido', 'completed', 'done']) {
    assert.equal(normalizeTaskStatus(status), TASK_STATUS.CONCLUIDA);
    assert.equal(isTaskCompletedStatus(status), true);
    assert.equal(isTaskOpenStatus(status), false);
  }

  assert.equal(isTaskArchivedStatus('Backlog'), true);
  assert.equal(isTaskOpenStatus('Backlog'), false);
  assert.equal(isTaskOpenStatus('em andamento'), true);
  assert.equal(isTaskActionableStatus('Pendente'), true);
  assert.equal(isTaskActionableStatus('Em andamento'), true);
  assert.equal(isTaskActionableStatus('Pausada'), false);
  assert.equal(isTaskActionableStatus('Aguardando retorno'), false);
});

test('concluir microtarefa avança automaticamente para o próximo passo', () => {
  const microtasks = [
    { id: 'step-1', title: 'Revisar a home', completed: false },
    { id: 'step-2', title: 'Corrigir os textos', completed: false },
    { id: 'step-3', title: 'Publicar', completed: false },
  ];

  const updated = upsertMicrotaskCompletion(microtasks, 'step-1', true, 'task-1');
  const progress = getTaskMicrotaskProgress({ id: 'task-1', microtarefas: updated });

  assert.equal(updated[0].completed, true);
  assert.equal(progress.completed, 1);
  assert.equal(progress.nextPending.id, 'step-2');
  assert.equal(progress.nextPending.title, 'Corrigir os textos');
});

test('concluir o último passo sinaliza que a tarefa não possui próximo passo', () => {
  const microtasks = [
    { id: 'step-1', title: 'Revisar', completed: true },
    { id: 'step-2', title: 'Publicar', completed: false },
  ];

  const updated = upsertMicrotaskCompletion(microtasks, 'step-2', true, 'task-1');
  const progress = getTaskMicrotaskProgress({ id: 'task-1', microtarefas: updated });

  assert.equal(progress.pending, 0);
  assert.equal(progress.nextPending, null);
});

test('centraliza marcadores de exclusao e tarefas operacionais', () => {
  assert.equal(isTaskDeleted({ status: 'pendente', deletedAt: '2026-09-12T10:00:00Z' }), true);
  assert.equal(isTaskDeleted({ status: 'pendente', isDeleted: true }), true);
  assert.equal(isTaskDeleted({ status: 'Excluída' }), true);
  assert.equal(isTaskOperational({ id: 'active', status: 'pendente' }), true);
  assert.equal(isTaskOperational({ id: 'archived', status: 'arquivada' }), false);
  assert.equal(isTaskOperational({ id: 'deleted', status: 'pendente', deletedAt: '2026-09-12' }), false);
});

test('remove referencias orfas sem apagar historico independente', () => {
  const records = [
    { id: 'active-session', taskId: 'active' },
    { id: 'deleted-session', taskId: 'deleted' },
    { id: 'missing-session', taskId: 'missing' },
    { id: 'independent-block', taskId: null },
  ];
  const tasks = [
    { id: 'active', status: 'pendente' },
    { id: 'deleted', status: 'pendente', isDeleted: true },
  ];

  assert.deepEqual(
    filterOperationalTaskReferences(records, tasks).map((item) => item.id),
    ['active-session', 'independent-block'],
  );
  assert.equal(records.length, 4);
});

test('exclusao remove a tarefa imediatamente do estado que alimenta o calendario', () => {
  const tasks = [
    { id: 'keep', status: 'pendente' },
    { id: 'delete', status: 'pendente' },
  ];

  const next = removeTaskFromOperationalState(tasks, 'delete');
  assert.deepEqual(next.map((task) => task.id), ['keep']);
  assert.equal(tasks.length, 2);
});