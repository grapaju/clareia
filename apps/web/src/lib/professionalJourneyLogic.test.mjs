import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkdayReport,
  calculateDailyJourneyMetrics,
  calculateJourneyMetrics,
  calculateWeeklyProgress,
  calculateWeeklySummaryProgress,
  getValidJourneyMetrics,
  getDailyTargetMinutes,
  getJourneyDisplayState,
  getProfessionalWeekRange,
  inferProfessionalCategory,
  isAnomalousJourney,
  isForgottenJourney,
  professionalActivitiesToCsv,
} from './professionalJourneyLogic.js';

test('calcula meta semanal de 40 horas em minutos', () => {
  const result = calculateWeeklyProgress({ weeklyTargetMinutes: 2400, now: '2026-09-03T12:00:00Z' });
  assert.equal(result.targetMinutes, 2400);
});

test('deriva referencia diaria da meta semanal e dos dias de trabalho', () => {
  assert.equal(getDailyTargetMinutes({ weeklyTargetMinutes: 2400, workDays: [1, 2, 3, 4, 5] }), 480);
  assert.equal(getDailyTargetMinutes({ weeklyTargetMinutes: 1800, workDays: [1, 2, 3] }), 600);
  assert.equal(getDailyTargetMinutes({ weeklyTargetMinutes: 0, workDays: [1, 2, 3, 4, 5] }), 0);
});

test('distingue os estados de apresentacao da jornada de hoje', () => {
  const base = { now: '2026-09-10T15:00:00Z', timeZone: 'UTC', projectName: 'Clareia' };
  assert.equal(getJourneyDisplayState(base).kind, 'not_started');
  assert.equal(getJourneyDisplayState({ ...base, currentJourney: { status: 'active' } }).kind, 'active');
  assert.equal(getJourneyDisplayState({ ...base, currentJourney: { status: 'paused' } }).kind, 'paused');

  const closedJourney = {
    id: 'closed-today', projectName: 'Clareia', status: 'closed',
    startedAt: '2026-09-10T08:00:00Z', endedAt: '2026-09-10T14:00:00Z', netMinutes: 330,
  };
  const closed = getJourneyDisplayState({ ...base, journeys: [closedJourney] });
  assert.equal(closed.kind, 'closed');
  assert.equal(closed.journey.id, 'closed-today');
});

test('nao trata jornada encerrada em outro dia como encerrada hoje', () => {
  const state = getJourneyDisplayState({
    now: '2026-09-10T15:00:00Z',
    timeZone: 'UTC',
    projectName: 'Clareia',
    journeys: [{ projectName: 'Clareia', status: 'closed', startedAt: '2026-09-09T08:00:00Z', endedAt: '2026-09-09T17:00:00Z' }],
  });
  assert.equal(state.kind, 'not_started');
});

test('desconta pausa da jornada liquida', () => {
  const metrics = calculateJourneyMetrics({
    journey: { startedAt: '2026-09-01T08:00:00Z', endedAt: '2026-09-01T17:00:00Z' },
    pauses: [{ startedAt: '2026-09-01T12:00:00Z', endedAt: '2026-09-01T13:00:00Z' }],
  });
  assert.equal(metrics.grossMinutes, 540);
  assert.equal(metrics.pauseMinutes, 60);
  assert.equal(metrics.netMinutes, 480);
});

test('jornada de 8h continua valendo 8h com apenas 2h registradas em tarefas', () => {
  const metrics = calculateJourneyMetrics({
    journey: { startedAt: '2026-09-01T08:00:00Z', endedAt: '2026-09-01T16:00:00Z' },
    taskSessions: [{ durationMinutes: 120 }],
  });
  assert.equal(metrics.netMinutes, 480);
  assert.equal('taskMinutes' in metrics, false);
  assert.equal('unclassifiedMinutes' in metrics, false);
});

test('soma jornadas da semana e informa restante', () => {
  const progress = calculateWeeklyProgress({
    journeys: [
      { id: 'j1', startedAt: '2026-08-31T08:00:00Z', endedAt: '2026-08-31T16:00:00Z' },
      { id: 'j2', startedAt: '2026-09-01T08:00:00Z', endedAt: '2026-09-01T16:00:00Z' },
    ],
    weeklyTargetMinutes: 2400,
    now: '2026-09-03T12:00:00Z',
  });
  assert.equal(progress.totalMinutes, 960);
  assert.equal(progress.remainingMinutes, 1440);
});

test('semana atravessa mes de segunda a domingo', () => {
  assert.deepEqual(getProfessionalWeekRange('2026-09-03T12:00:00Z'), { startDate: '2026-08-31', endDate: '2026-09-06' });
});

test('semana atravessa ano de segunda a domingo', () => {
  assert.deepEqual(getProfessionalWeekRange('2027-01-01T12:00:00Z'), { startDate: '2026-12-28', endDate: '2027-01-03' });
});

test('informa excedente semanal com valor neutro', () => {
  const progress = calculateWeeklyProgress({
    journeys: [
      { id: 'j1', startedAt: '2026-08-31T08:00:00Z', endedAt: '2026-08-31T16:00:00Z' },
      { id: 'j2', startedAt: '2026-09-01T08:00:00Z', endedAt: '2026-09-01T16:00:00Z' },
      { id: 'j3', startedAt: '2026-09-02T08:00:00Z', endedAt: '2026-09-02T16:00:00Z' },
      { id: 'j4', startedAt: '2026-09-03T08:00:00Z', endedAt: '2026-09-03T16:00:00Z' },
      { id: 'j5', startedAt: '2026-09-04T08:00:00Z', endedAt: '2026-09-04T17:10:00Z' },
    ],
    weeklyTargetMinutes: 2400,
    now: '2026-09-04T18:00:00Z',
  });
  assert.equal(progress.aboveTargetMinutes, 70);
  assert.equal(progress.remainingMinutes, 0);
});

test('infere categorias profissionais sem bloquear categoria Outro', () => {
  assert.equal(inferProfessionalCategory('Reunião com Márcio'), 'Reunião');
  assert.equal(inferProfessionalCategory('Corrigir erro no cadastro'), 'Correção / manutenção');
  assert.equal(inferProfessionalCategory('Criar módulo de contratos'), 'Desenvolvimento');
  assert.equal(inferProfessionalCategory('Conversa rápida'), 'Outro');
});

test('relatorio de jornada usa somente jornadas e pausas', () => {
  const report = buildWorkdayReport({
    journeys: [{ id: 'j1', startedAt: '2026-08-31T08:00:00Z', endedAt: '2026-08-31T16:00:00Z' }],
    pauses: [{ journeyId: 'j1', startedAt: '2026-08-31T12:00:00Z', endedAt: '2026-08-31T13:00:00Z' }],
    taskSessions: [{ durationMinutes: 300 }],
    weeklyTargetMinutes: 2400,
    now: '2026-09-03T12:00:00Z',
  });
  assert.equal(report.weekly.totalMinutes, 420);
  assert.equal(report.weekly.pauseMinutes, 60);
  assert.equal(report.weekly.balanceMinutes, -1980);
  assert.equal(report.workdayDuration, 420);
  assert.equal(report.pauseDuration, 60);
  assert.equal(report.closedWorkdays, 0);
  assert.deepEqual(report.dailyRows, [{ date: '2026-08-31', workdayDuration: 420, pauseDuration: 60, closedWorkdays: 0 }]);
});

test('relatorio de jornada separa horas por dia quando cruza meia-noite', () => {
  const report = buildWorkdayReport({
    journeys: [{ id: 'overnight', status: 'closed', startedAt: '2026-09-01T22:00:00Z', endedAt: '2026-09-02T02:00:00Z' }],
    now: '2026-09-03T12:00:00Z',
    timeZone: 'UTC',
  });
  assert.deepEqual(report.dailyRows, [
    { date: '2026-09-02', workdayDuration: 120, pauseDuration: 0, closedWorkdays: 1 },
    { date: '2026-09-01', workdayDuration: 120, pauseDuration: 0, closedWorkdays: 0 },
  ]);
});

test('CSV profissional preserva campos e escapa observacao', () => {
  const csv = professionalActivitiesToCsv([{
    projectName: 'inPACTA', title: 'Reunião', category: 'Reunião', startedAt: '2026-09-01T14:00:00Z',
    endedAt: '2026-09-01T15:10:00Z', durationMinutes: 70, source: 'manual', notes: 'Márcio; contratos',
  }]);
  assert.match(csv, /Tarefa\/atividade;Categoria;Início;Fim/);
  assert.match(csv, /inPACTA;Reunião;Reunião/);
  assert.match(csv, /manual;sim;"Márcio; contratos"/);
});

test('detecta jornada esquecida sem alterar dados', () => {
  assert.equal(isForgottenJourney({ startedAt: '2026-09-01T08:00:00Z' }, '2026-09-02T02:00:00Z'), true);
  assert.equal(isForgottenJourney({ startedAt: '2026-09-01T08:00:00Z', endedAt: '2026-09-01T17:00:00Z' }), false);
});

test('soma resumos liquidos persistidos sem recontar pausas', () => {
  const progress = calculateWeeklySummaryProgress({
    journeys: [
      { startedAt: '2026-08-31T11:00:00Z', netMinutes: 480 },
      { startedAt: '2026-09-01T11:00:00Z', netMinutes: 510 },
    ],
    weeklyTargetMinutes: 2400,
    now: '2026-09-03T12:00:00Z',
  });
  assert.equal(progress.totalMinutes, 990);
  assert.equal(progress.remainingMinutes, 1410);
});

test('respeita o dia local do fuso na virada UTC', () => {
  const range = getProfessionalWeekRange('2026-09-07T01:00:00Z', 'America/Sao_Paulo');
  assert.deepEqual(range, { startDate: '2026-08-31', endDate: '2026-09-06' });
});

test('calcula jornada aberta usando o instante informado', () => {
  const metrics = calculateJourneyMetrics({
    journey: { startedAt: '2026-09-01T08:00:00Z' },
    now: '2026-09-01T10:30:00Z',
  });
  assert.equal(metrics.netMinutes, 150);
});

test('progresso diario recorta uma jornada esquecida ao dia atual', () => {
  const metrics = calculateDailyJourneyMetrics({
    journey: { startedAt: '2026-09-01T08:00:00Z' },
    pauses: [{ startedAt: '2026-09-01T22:00:00Z', endedAt: '2026-09-02T01:00:00Z' }],
    now: '2026-09-02T10:30:00Z',
    timeZone: 'UTC',
  });
  assert.equal(metrics.grossMinutes, 630);
  assert.equal(metrics.pauseMinutes, 60);
  assert.equal(metrics.netMinutes, 570);
});

test('jornada aberta por mais de 16h fica anomala e nao gera horas validas automaticamente', () => {
  const journey = { startedAt: '2026-09-05T20:44:00Z', status: 'active' };
  assert.equal(isAnomalousJourney(journey, '2026-09-10T15:00:00Z', 'UTC'), true);
  const result = getValidJourneyMetrics({ journey, now: '2026-09-10T15:00:00Z', timeZone: 'UTC' });
  assert.equal(result.isAnomalous, true);
  assert.equal(result.validMinutes, 0);
  assert.equal(result.rawMinutes, 6856);
});

test('jornada aberta que atravessa meia-noite exige confirmacao mesmo abaixo de 16h', () => {
  const journey = { startedAt: '2026-09-09T23:30:00Z', status: 'paused' };
  assert.equal(isAnomalousJourney(journey, '2026-09-10T01:00:00Z', 'UTC'), true);
});

test('jornada encerrada usa somente a parcela do dia como tempo valido diario', () => {
  const result = getValidJourneyMetrics({
    journey: { startedAt: '2026-09-09T20:00:00Z', endedAt: '2026-09-10T02:00:00Z', status: 'closed' },
    now: '2026-09-10T12:00:00Z',
    timeZone: 'UTC',
  });
  assert.equal(result.isAnomalous, false);
  assert.equal(result.validMinutes, 120);
  assert.equal(result.rawMinutes, 360);
});

test('cinco horas em tarefas nao alteram automaticamente a jornada', () => {
  const result = getValidJourneyMetrics({
    journey: { startedAt: '2026-09-10T08:00:00Z', endedAt: '2026-09-10T12:00:00Z', status: 'closed' },
    taskSessions: [{ taskId: 'task-1', durationMinutes: 300 }],
    now: '2026-09-10T15:00:00Z',
    timeZone: 'UTC',
  });
  assert.equal(result.validMinutes, 240);
  assert.equal('taskMinutes' in result, false);
});

test('soma semanal considera intersecao de jornada iniciada antes da semana', () => {
  const progress = calculateWeeklyProgress({
    journeys: [{ id: 'cross-week', startedAt: '2026-09-06T22:00:00Z', endedAt: '2026-09-07T02:00:00Z', status: 'closed' }],
    weeklyTargetMinutes: 2400,
    now: '2026-09-10T12:00:00Z',
    timeZone: 'UTC',
  });
  assert.equal(progress.totalMinutes, 120);
  assert.equal(progress.remainingMinutes, 2280);
});

test('soma semanal exclui jornada aberta anomala sem apagar o bruto', () => {
  const progress = calculateWeeklyProgress({
    journeys: [{ id: 'old-open', startedAt: '2026-09-05T20:44:00Z', status: 'active' }],
    weeklyTargetMinutes: 2400,
    now: '2026-09-10T15:00:00Z',
    timeZone: 'UTC',
  });
  assert.equal(progress.totalMinutes, 0);
});

test('desconta pausa ainda aberta ate o instante atual', () => {
  const metrics = calculateJourneyMetrics({
    journey: { startedAt: '2026-09-01T08:00:00Z' },
    pauses: [{ startedAt: '2026-09-01T10:00:00Z' }],
    now: '2026-09-01T10:30:00Z',
  });
  assert.equal(metrics.pauseMinutes, 30);
  assert.equal(metrics.netMinutes, 120);
});

test('metricas da jornada nao produzem diferenca sem tarefa associada', () => {
  const metrics = calculateJourneyMetrics({
    journey: { startedAt: '2026-09-01T08:00:00Z', endedAt: '2026-09-01T09:00:00Z' },
    taskSessions: [{ durationMinutes: 120 }],
  });
  assert.equal(metrics.netMinutes, 60);
  assert.equal('unclassifiedMinutes' in metrics, false);
});

test('CSV vazio preserva cabecalho profissional', () => {
  const csv = professionalActivitiesToCsv([]);
  assert.match(csv, /^Data;Projeto;Tarefa\/atividade;Categoria;/);
  assert.equal(csv.split('\n').length, 1);
});

test('intervalos invalidos resultam em zero sem quebrar o relatorio', () => {
  const metrics = calculateJourneyMetrics({ journey: { startedAt: 'invalido', endedAt: 'invalido' } });
  assert.equal(metrics.netMinutes, 0);
});