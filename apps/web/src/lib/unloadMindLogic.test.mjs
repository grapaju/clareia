import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBrainDumpToTasks } from './unloadMindLogic.js';

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