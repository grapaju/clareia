import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTaskActionableStatus,
  isTaskArchivedStatus,
  isTaskCompletedStatus,
  isTaskOpenStatus,
  normalizeTaskStatus,
  TASK_STATUS,
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