const UNSORTED_NOTES_STORAGE_KEY = 'clareia_unsorted_notes';
const NOTES_UPDATED_EVENT = 'clareia-unsorted-notes-updated';

function safeParse(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeStatus(status) {
  if (status === 'organizada' || status === 'transformada' || status === 'pendente') {
    return status;
  }
  return 'pendente';
}

function normalizeNote(note, userId = null) {
  const now = new Date().toISOString();
  return {
    id: String(note?.id || crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    content: String(note?.content || '').trim(),
    createdAt: note?.createdAt || now,
    updatedAt: note?.updatedAt || null,
    status: normalizeStatus(note?.status),
    source: note?.source || 'descarregar-mente',
    userId: note?.userId || userId || null
  };
}

function readRawNotes() {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(UNSORTED_NOTES_STORAGE_KEY));
}

function writeRawNotes(notes) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(UNSORTED_NOTES_STORAGE_KEY, JSON.stringify(notes));
  window.dispatchEvent(new CustomEvent(NOTES_UPDATED_EVENT));
}

export function listUnsortedNotes(userId, status = null) {
  const notes = readRawNotes()
    .map((note) => normalizeNote(note, userId))
    .filter((note) => !userId || note.userId === userId)
    .filter((note) => (status ? note.status === status : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return notes;
}

export function countPendingUnsortedNotes(userId) {
  return listUnsortedNotes(userId, 'pendente').length;
}

export function createUnsortedNote({ content, userId, source = 'descarregar-mente' }) {
  const normalizedContent = String(content || '').trim();
  if (!normalizedContent) return null;

  const note = normalizeNote({
    content: normalizedContent,
    source,
    status: 'pendente',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    userId
  }, userId);

  const allNotes = readRawNotes();
  allNotes.push(note);
  writeRawNotes(allNotes);
  return note;
}

export function updateUnsortedNote(noteId, updates, userId = null) {
  const allNotes = readRawNotes();
  const index = allNotes.findIndex((note) => note?.id === noteId && (!userId || note?.userId === userId));
  if (index < 0) return null;

  const previous = normalizeNote(allNotes[index], userId);
  const updated = normalizeNote({
    ...previous,
    ...updates,
    content: typeof updates?.content === 'string' ? updates.content.trim() : previous.content,
    updatedAt: new Date().toISOString()
  }, userId);

  allNotes[index] = updated;
  writeRawNotes(allNotes);
  return updated;
}

export function removeUnsortedNote(noteId, userId = null) {
  const allNotes = readRawNotes();
  const next = allNotes.filter((note) => !(note?.id === noteId && (!userId || note?.userId === userId)));
  if (next.length === allNotes.length) return false;

  writeRawNotes(next);
  return true;
}

export function subscribeToUnsortedNotes(callback) {
  if (typeof window === 'undefined') return () => {};

  const handler = () => callback();
  window.addEventListener('storage', handler);
  window.addEventListener(NOTES_UPDATED_EVENT, handler);

  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(NOTES_UPDATED_EVENT, handler);
  };
}

export function formatNoteDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

export { UNSORTED_NOTES_STORAGE_KEY };
