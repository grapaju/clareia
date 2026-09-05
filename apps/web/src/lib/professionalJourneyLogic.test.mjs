import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfessionalReport,
  calculateJourneyMetrics,
  calculateWeeklyProgress,
  calculateWeeklySummaryProgress,
  getProfessionalWeekRange,
  inferProfessionalCategory,
  isForgottenJourney,
  professionalActivitiesToCsv,
} from './professionalJourneyLogic.js';

test('calcula meta semanal de 40 horas em minutos', () => {
  const result = calculateWeeklyProgress({ weeklyTargetMinutes: 2400, now: '2026-09-03T12:00:00Z' });
  assert.equal(result.targetMinutes, 2400);
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

test('calcula tempo associado e nao associado sem exigir classificacao total', () => {
  const metrics = calculateJourneyMetrics({
    journey: { startedAt: '2026-09-01T08:00:00Z', endedAt: '2026-09-01T16:00:00Z' },
    activities: [{ durationMinutes: 435 }],
  });
  assert.equal(metrics.activityMinutes, 435);
  assert.equal(metrics.unclassifiedMinutes, 45);
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
    journeys: [{ id: 'j1', startedAt: '2026-09-01T00:00:00Z', endedAt: '2026-09-02T17:10:00Z' }],
    weeklyTargetMinutes: 2400,
    now: '2026-09-03T12:00:00Z',
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

test('relatorio agrega categorias e atividades reais sem inventar entregas', () => {
  const report = buildProfessionalReport({ activities: [
    { title: 'Criar módulo', category: 'Desenvolvimento', durationMinutes: 120 },
    { title: 'Criar módulo', category: 'Desenvolvimento', durationMinutes: 30 },
    { title: 'Reunião de alinhamento', category: 'Reunião', durationMinutes: 45 },
  ] });
  assert.deepEqual(report.categoryMinutes, { Desenvolvimento: 150, Reunião: 45 });
  assert.deepEqual(report.principalActivities, ['Criar módulo', 'Reunião de alinhamento']);
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

test('desconta pausa ainda aberta ate o instante atual', () => {
  const metrics = calculateJourneyMetrics({
    journey: { startedAt: '2026-09-01T08:00:00Z' },
    pauses: [{ startedAt: '2026-09-01T10:00:00Z' }],
    now: '2026-09-01T10:30:00Z',
  });
  assert.equal(metrics.pauseMinutes, 30);
  assert.equal(metrics.netMinutes, 120);
});

test('nao produz tempo sem atividade negativo', () => {
  const metrics = calculateJourneyMetrics({
    journey: { startedAt: '2026-09-01T08:00:00Z', endedAt: '2026-09-01T09:00:00Z' },
    activities: [{ durationMinutes: 90 }],
  });
  assert.equal(metrics.unclassifiedMinutes, 0);
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