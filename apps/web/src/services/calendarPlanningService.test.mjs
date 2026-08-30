import test from 'node:test';
import assert from 'node:assert/strict';
import { plannedMinutesForDate } from './calendarPlanningService.js';

test('carga planejada ignora tarefas concluidas e tempo realizado', () => {
  const dateIso = '2026-08-24';
  const plannedMinutes = plannedMinutesForDate({
    dateIso,
    tasks: [
      { status: 'pendente', scheduledDate: dateIso, timeEstimate: 45 },
      { status: 'Concluída', scheduledDate: dateIso, timeEstimate: 195 },
    ],
    focusBlocks: [
      { startedAt: `${dateIso}T09:00:00`, durationMinutes: 4 },
      { startedAt: `${dateIso}T10:00:00`, durationMinutes: 30, source: 'manual' },
    ],
  });

  assert.equal(plannedMinutes, 45);
});