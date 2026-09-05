import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTaskMicrotaskProgress,
  isTaskActionableStatus,
  isTaskArchivedStatus,
  isTaskCompletedStatus,
  isTaskOpenStatus,
  normalizeTaskStatus,
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