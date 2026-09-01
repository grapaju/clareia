import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
  dispatchEvent: () => {},
};
globalThis.CustomEvent = class CustomEvent {};

const {
  countPendingUnsortedNotes,
  createUnsortedNote,
  formatSavedWaitingTime,
  listUnsortedNotes,
  updateUnsortedNote,
} = await import('./unsortedNotesStorage.js');

test('guarda captura uma vez e preserva estados canonicos', () => {
  storage.clear();
  const first = createUnsortedNote({ content: 'Ligar para o cliente', userId: 'user-1' });
  const retry = createUnsortedNote({ content: 'Ligar para o cliente', userId: 'user-1' });

  assert.equal(first.id, retry.id);
  assert.equal(countPendingUnsortedNotes('user-1'), 1);

  updateUnsortedNote(first.id, { status: 'organizada', project: 'IDP-PR' }, 'user-1');
  assert.equal(countPendingUnsortedNotes('user-1'), 0);
  assert.equal(listUnsortedNotes('user-1', 'processado')[0].project, 'IDP-PR');
});

test('formata tempo guardado por dia local sem linguagem de atraso', () => {
  const reference = new Date(2026, 8, 1, 12);
  assert.equal(formatSavedWaitingTime('2026-09-01T00:15:00-03:00', reference), 'Guardado hoje');
  assert.equal(formatSavedWaitingTime('2026-08-31T23:30:00-03:00', reference), 'Guardado ontem');
  assert.equal(formatSavedWaitingTime('2026-08-28T10:00:00-03:00', reference), 'Guardado há 4 dias');
  assert.equal(formatSavedWaitingTime('2026-08-25T10:00:00-03:00', reference), 'Guardado em 25/08/2026');
});