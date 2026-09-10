import test from 'node:test';
import assert from 'node:assert/strict';

const values = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  }
};

const { getLatestDailyWrapUpForResume, listDailyWrapUps, replaceDailyWrapUps, saveDailyWrapUp, updateDailyWrapUpResumeState } = await import('./dailyWrapUpService.js');

test.beforeEach(() => values.clear());

test('salva contexto estruturado de retomada e horário real', () => {
  const record = saveDailyWrapUp('user-a', {
    date: '2026-09-10',
    concluded: 'Atualização da página\nRevisão dos documentos',
    continueContext: 'Continuar pelo checkout',
    waitingExternal: 'Documento do financeiro',
    endedAt: '2026-09-10T21:00:00.000Z',
    journeyId: 'journey-1',
    journeyProjectName: 'inPACTA'
  });

  assert.equal(record.concluded, 'Atualização da página\nRevisão dos documentos');
  assert.equal(record.continueContext, 'Continuar pelo checkout');
  assert.equal(record.waitingExternal, 'Documento do financeiro');
  assert.equal(record.paused, 'Continuar pelo checkout');
  assert.equal(record.waitingReturn, 'Documento do financeiro');
  assert.equal(record.endedAt, '2026-09-10T21:00:00.000Z');
  assert.equal(record.journeyId, 'journey-1');
  assert.equal(record.journeyProjectName, 'inPACTA');
  assert.equal('continueTaskIds' in record, false);
});

test('restaura o contexto anterior quando o encerramento falha', () => {
  const previous = [{ id: 'prior', date: '2026-09-09', paused: 'Contexto anterior' }];
  replaceDailyWrapUps('user-a', previous);
  saveDailyWrapUp('user-a', { date: '2026-09-10', paused: 'Tentativa atual' });
  replaceDailyWrapUps('user-a', previous);

  assert.deepEqual(listDailyWrapUps('user-a'), previous);
});

test('oferece o último contexto anterior para retomada no dia seguinte', () => {
  saveDailyWrapUp('user-a', { date: '2026-09-09', paused: 'Retomar pelo módulo de transparência', journeyProjectName: 'inPACTA' });
  assert.equal(
    getLatestDailyWrapUpForResume('user-a', new Date(2026, 8, 10, 8, 0, 0), 'inPACTA').paused,
    'Retomar pelo módulo de transparência'
  );
  assert.equal(getLatestDailyWrapUpForResume('user-a', new Date(2026, 8, 10, 8, 0, 0), 'Outro vínculo'), null);
});

test('permite retomar, resolver ou deixar contexto para outro dia sem criar tarefa', () => {
  const record = saveDailyWrapUp('user-a', { date: '2026-09-09', paused: 'Revisar contratos', journeyProjectName: 'inPACTA' });
  updateDailyWrapUpResumeState('user-a', record.id, 'deferred', new Date(2026, 8, 10, 8, 0, 0));
  assert.equal(getLatestDailyWrapUpForResume('user-a', new Date(2026, 8, 10, 10, 0, 0), 'inPACTA'), null);
  assert.equal(getLatestDailyWrapUpForResume('user-a', new Date(2026, 8, 11, 8, 0, 0), 'inPACTA').id, record.id);
  updateDailyWrapUpResumeState('user-a', record.id, 'resolved');
  assert.equal(getLatestDailyWrapUpForResume('user-a', new Date(2026, 8, 11, 8, 0, 0), 'inPACTA'), null);
});