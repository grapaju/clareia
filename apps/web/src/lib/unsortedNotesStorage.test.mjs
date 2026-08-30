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