import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modalUrl = new URL('../components/DailyWrapUpDialog.jsx', import.meta.url);

test('modal da Jornada não consulta a lista global nem sessões de tarefas', async () => {
  const source = await readFile(modalUrl, 'utf8');
  assert.doesNotMatch(source, /useTaskContext|TaskContext|listWorkSessions|workSessionService|tasksApiService/);
});

test('Jornada inPACTA não lista tarefas de IDT-PR, Corcril ou Pessoal', async () => {
  const source = await readFile(modalUrl, 'utf8');
  assert.doesNotMatch(source, /IDT-PR|Corcril|Pessoal|TaskChecklist|Quais tarefas|TASK_STATUS/i);
});

test('encerramento da Jornada usa somente a operação de fechamento da Jornada', async () => {
  const source = await readFile(modalUrl, 'utf8');
  assert.match(source, /closeWork\(closingNote, endedAt\)/);
  assert.doesNotMatch(source, /completeTask|updateTask|addTask|finishActiveWorkSession/);
});

test('modal funciona sem estrutura própria de tarefas da Jornada', async () => {
  const source = await readFile(modalUrl, 'utf8');
  assert.match(source, /O que você concluiu hoje\?/);
  assert.match(source, /O que ficou para continuar\?/);
  assert.match(source, /Ficou algo aguardando retorno externo\?/);
  assert.match(source, /Guardar e encerrar o dia/);
});

test('fluxo normal não pede data e hora e a correção fica restrita à anomalia', async () => {
  const source = await readFile(modalUrl, 'utf8');
  assert.doesNotMatch(source, /Quando o trabalho terminou\?/);
  assert.match(source, /\{anomalous && \(/);
  assert.match(source, /Corrigir horário de encerramento/);
});

test('API da Jornada não consulta nem cria vínculo com tarefas de Projetos', async () => {
  const source = await readFile(new URL('../../../api/src/routes/professional-journeys.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /FROM tasks|req\.body\?\.taskId|req\.body\?\.workSessionId/);
});