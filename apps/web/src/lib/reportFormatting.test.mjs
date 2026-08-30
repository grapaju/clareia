import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDurationFriendly, pluralizeCount } from './reportFormatting.js';

test('formata tempo curto em minutos e tempo longo sem decimal', () => {
  assert.equal(formatDurationFriendly(4), '4 min');
  assert.equal(formatDurationFriendly(65), '1h 05min');
});

test('pluraliza tarefas e sessoes', () => {
  assert.equal(pluralizeCount(1, 'tarefa concluída', 'tarefas concluídas'), '1 tarefa concluída');
  assert.equal(pluralizeCount(2, 'sessão', 'sessões'), '2 sessões');
});
