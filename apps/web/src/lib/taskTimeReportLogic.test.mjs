import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildTaskTimeReport } from './taskTimeReportLogic.js';

test('relatorio de tarefas usa somente sessoes de tarefas e projetos', () => {
  const report = buildTaskTimeReport([
    { taskId: 'idt-site', taskTitle: 'Revisar site', projectId: 'IDT-PR', durationMinutes: 105 },
    { taskId: 'analytics', taskTitle: 'Google Analytics', projectId: 'Corcril', durationMinutes: 130 },
  ]);

  assert.equal(report.taskTrackedTime, 235);
  assert.deepEqual(report.byProject.map(({ project, minutes }) => ({ project, minutes })), [
    { project: 'Corcril', minutes: 130 },
    { project: 'IDT-PR', minutes: 105 },
  ]);
  assert.deepEqual(report.byTask.map(({ taskId, minutes }) => ({ taskId, minutes })), [
    { taskId: 'analytics', minutes: 130 },
    { taskId: 'idt-site', minutes: 105 },
  ]);
});

test('totais diferentes entre jornada e tarefas sao aceitos', () => {
  const taskReport = buildTaskTimeReport([{ taskId: 'task-1', durationMinutes: 120 }]);
  const workdayDuration = 480;

  assert.equal(taskReport.taskTrackedTime, 120);
  assert.equal(workdayDuration, 480);
  assert.notEqual(taskReport.taskTrackedTime, workdayDuration);
});

test('iniciar tarefa nao inicia jornada e iniciar jornada nao inicia tarefa', async () => {
  const [home, focus, journeyContext] = await Promise.all([
    readFile(new URL('../pages/HomePage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../pages/FocusPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../contexts/ProfessionalJourneyContext.jsx', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(home, /startProfessionalJourney|startActivity/);
  assert.doesNotMatch(focus, /useProfessionalJourney|startProfessionalJourney|startActivity/);
  assert.doesNotMatch(journeyContext, /useTaskContext|startTimerWorkSession|startTask/);
});

test('pausar jornada nao altera cronometro e concluir tarefa nao encerra jornada', async () => {
  const [wrapUp, taskContext, journeyRoute] = await Promise.all([
    readFile(new URL('../components/DailyWrapUpDialog.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../contexts/TaskContext.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../../../api/src/routes/professional-journeys.js', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(wrapUp, /pauseTask/);
  assert.doesNotMatch(taskContext, /ProfessionalJourney|closeProfessionalJourney|closeWork/);
  assert.doesNotMatch(journeyRoute, /closeActiveActivity\(client, req\.userId, (pausedAt|endedAt)\)/);
});