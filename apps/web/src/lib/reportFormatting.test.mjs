import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDurationFriendly, getCheckInAvailableMinutes, pluralizeCount } from './reportFormatting.js';

test('formata duracoes em linguagem humana', () => {
  assert.equal(formatDurationFriendly(0), '0h');
  assert.equal(formatDurationFriendly(18), '18 min');
  assert.equal(formatDurationFriendly(59), '59 min');
  assert.equal(formatDurationFriendly(60), '1h');
  assert.equal(formatDurationFriendly(61), '1h01');
  assert.equal(formatDurationFriendly(105), '1h45');
  assert.equal(formatDurationFriendly(130), '2h10');
});

test('pluraliza tarefas e sessoes', () => {
  assert.equal(pluralizeCount(1, 'tarefa concluída', 'tarefas concluídas'), '1 tarefa concluída');
  assert.equal(pluralizeCount(2, 'sessão', 'sessões'), '2 sessões');
});

test('converte todas as opções do check-in em minutos declarados', () => {
  assert.equal(getCheckInAvailableMinutes('15min'), 15);
  assert.equal(getCheckInAvailableMinutes('30min'), 30);
  assert.equal(getCheckInAvailableMinutes('1h'), 60);
  assert.equal(getCheckInAvailableMinutes('2h'), 120);
});
