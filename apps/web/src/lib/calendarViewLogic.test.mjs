import test from 'node:test';
import assert from 'node:assert/strict';
import { formatWeekRangeLong, formatWeekRangeShort, getCalendarTaskActions } from './calendarViewLogic.js';

test('formata semana atravessando o mês', () => {
  const date = new Date(2026, 8, 3, 12);
  assert.equal(formatWeekRangeLong(date), '31 de agosto a 6 de setembro de 2026');
  assert.equal(formatWeekRangeShort(date), '31 ago. – 6 set. 2026');
});

test('formata semana atravessando o ano', () => {
  const date = new Date(2026, 11, 31, 12);
  assert.equal(formatWeekRangeLong(date), '28 de dezembro de 2026 a 3 de janeiro de 2027');
  assert.equal(formatWeekRangeShort(date), '28 dez. 2026 – 3 jan. 2027');
});

test('formata corretamente fevereiro comum e ano bissexto', () => {
  assert.equal(formatWeekRangeLong(new Date(2026, 1, 12, 12)), '9 a 15 de fevereiro de 2026');
  assert.equal(formatWeekRangeLong(new Date(2024, 1, 29, 12)), '26 de fevereiro a 3 de março de 2024');
});

test('ações principais refletem o estado da tarefa', () => {
  assert.deepEqual(getCalendarTaskActions('pausada'), { primaryActionLabel: 'Retomar', showComplete: true, showReopen: false });
  assert.deepEqual(getCalendarTaskActions('em_andamento'), { primaryActionLabel: 'Continuar', showComplete: true, showReopen: false });
  assert.deepEqual(getCalendarTaskActions('pendente'), { primaryActionLabel: 'Começar', showComplete: true, showReopen: false });
});

test('tarefa concluída mostra Reabrir e nunca mostra Concluir', () => {
  assert.deepEqual(getCalendarTaskActions('concluída'), { primaryActionLabel: '', showComplete: false, showReopen: true });
});

test('formata semana dentro do mesmo mês', () => {
  const date = new Date(2026, 8, 16, 12);
  assert.equal(formatWeekRangeLong(date), '14 a 20 de setembro de 2026');
  assert.equal(formatWeekRangeShort(date), '14–20 set. 2026');
});