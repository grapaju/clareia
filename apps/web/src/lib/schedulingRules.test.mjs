import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTaskScheduleLabel, getScheduledLabelForTask } from './schedulingRules.js';

const currentDate = new Date(2026, 8, 16, 12, 0, 0);

test('formata hoje com o período de execução', () => {
  assert.equal(formatTaskScheduleLabel('2026-09-16', 'Manhã', currentDate), 'Hoje de manhã');
  assert.equal(formatTaskScheduleLabel('2026-09-16', 'Tarde', currentDate), 'Hoje à tarde');
  assert.equal(formatTaskScheduleLabel('2026-09-16', 'Noite', currentDate), 'Hoje à noite');
});

test('formata amanhã com o período de execução', () => {
  assert.equal(formatTaskScheduleLabel('2026-09-17', 'Manhã', currentDate), 'Amanhã de manhã');
  assert.equal(formatTaskScheduleLabel('2026-09-17', 'Tarde', currentDate), 'Amanhã à tarde');
  assert.equal(formatTaskScheduleLabel('2026-09-17', 'Noite', currentDate), 'Amanhã à noite');
});

test('datas futuras e atrasadas nunca são exibidas como hoje', () => {
  assert.doesNotMatch(formatTaskScheduleLabel('2026-09-18', 'Tarde', currentDate), /Hoje/i);
  assert.equal(formatTaskScheduleLabel('2026-09-15', 'Tarde', currentDate), 'Atrasada · 15/09');
});

test('data ISO de calendário não sofre deslocamento por UTC', () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'America/Sao_Paulo';
  try {
    assert.equal(formatTaskScheduleLabel('2026-09-17', 'Tarde', currentDate), 'Amanhã à tarde');
  } finally {
    process.env.TZ = previousTimezone;
  }
});

test('campos planejados prevalecem sobre etiqueta derivada obsoleta', () => {
  const label = getScheduledLabelForTask({
    scheduledDate: '2026-09-17',
    scheduledPeriod: 'Manhã',
    whenToExecute: 'Hoje de Manhã',
    scheduledLabel: 'Hoje de Manhã',
  }, currentDate);
  assert.equal(label, 'Amanhã de manhã');
});

test('confirma os três casos reais dos cards de projeto', () => {
  assert.equal(getScheduledLabelForTask({ title: 'Revisar produtos do grupo Refrigeração Comercial', scheduledDate: '2026-09-17', scheduledPeriod: 'Tarde' }, currentDate), 'Amanhã à tarde');
  assert.equal(getScheduledLabelForTask({ title: 'Registrar situação atual da campanha Google Ads', scheduledDate: '2026-09-16', scheduledPeriod: 'Tarde' }, currentDate), 'Hoje à tarde');
  assert.equal(getScheduledLabelForTask({ title: 'Continuar Google Analytics / conversões da Corcril', scheduledDate: '2026-09-17', scheduledPeriod: 'Manhã' }, currentDate), 'Amanhã de manhã');
});