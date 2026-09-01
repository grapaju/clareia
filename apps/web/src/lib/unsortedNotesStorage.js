import { integratedAiClient } from './integratedAiClient.js';
import { readUserScopedJson, writeUserScopedJson } from './userScopedStorage.js';
import { parseLocalDate } from './localDate.js';

const UNSORTED_NOTES_STORAGE_KEY = 'clareia_unsorted_notes';
const NOTES_UPDATED_EVENT = 'clareia-unsorted-notes-updated';
const REMOTE_COLLECTION = 'guardados';

function safeParse(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeStatus(status) {
  if (status === 'organizada' || status === 'transformada' || status === 'processado') return 'processado';
  if (status === 'arquivada' || status === 'arquivado') return 'arquivado';
  return 'aguardando_organizacao';
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
    project: String(note?.project || '').trim(),
    projectCandidate: String(note?.projectCandidate || '').trim(),
    idempotencyKey: String(note?.idempotencyKey || '').trim(),
    userId: note?.userId || userId || null
  };
}

function readRawNotes(userId) {
  return safeParse(JSON.stringify(readUserScopedJson(UNSORTED_NOTES_STORAGE_KEY, [], userId)));
}

function writeRawNotes(notes, userId) {
  if (!writeUserScopedJson(UNSORTED_NOTES_STORAGE_KEY, notes, userId)) return;
  window.dispatchEvent(new CustomEvent(NOTES_UPDATED_EVENT));
}

async function upsertRemoteNote(note) {
  if (!note?.userId || typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  const encodedId = encodeURIComponent(note.id);
  try {
    await integratedAiClient.fetch(`/records/${REMOTE_COLLECTION}/${encodedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note)
    });
  } catch (error) {
    if (error?.status !== 404) throw error;
    await integratedAiClient.fetch(`/records/${REMOTE_COLLECTION}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note)
    });
  }
}

function queueRemoteUpsert(note) {
  upsertRemoteNote(note).catch(() => {});
}

export async function syncUnsortedNotesFromApi(userId) {
  if (!userId || typeof window === 'undefined' || typeof window.fetch !== 'function') return listUnsortedNotes(userId);

  const response = await integratedAiClient.fetch(`/records/${REMOTE_COLLECTION}?sort=-updated`);
  const local = readRawNotes(userId).map((note) => normalizeNote(note, note?.userId));
  const remote = (Array.isArray(response?.items) ? response.items : []).map((note) => normalizeNote(note, userId));
  const merged = new Map(local.map((note) => [note.id, note]));

  remote.forEach((remoteNote) => {
    const localNote = merged.get(remoteNote.id);
    const localTimestamp = new Date(localNote?.updatedAt || localNote?.createdAt || 0).getTime();
    const remoteTimestamp = new Date(remoteNote.updatedAt || remoteNote.createdAt || 0).getTime();
    if (!localNote || remoteTimestamp >= localTimestamp) merged.set(remoteNote.id, remoteNote);
  });

  const notes = Array.from(merged.values());
  writeRawNotes(notes, userId);
  notes.filter((note) => note.userId === userId).forEach(queueRemoteUpsert);
  return listUnsortedNotes(userId);
}

export function listUnsortedNotes(userId, status = null) {
  const normalizedFilter = status ? normalizeStatus(status) : null;
  if (!userId) return [];
  const notes = readRawNotes(userId)
    .map((note) => normalizeNote(note, note?.userId))
    .filter((note) => !userId || note.userId === userId)
    .filter((note) => (normalizedFilter ? note.status === normalizedFilter : true))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return notes;
}

export function countPendingUnsortedNotes(userId) {
  return listUnsortedNotes(userId, 'aguardando_organizacao').length;
}

export function createUnsortedNote({ content, userId, source = 'descarregar-mente', project = '', projectCandidate = '', idempotencyKey = '' }) {
  const normalizedContent = String(content || '').trim();
  if (!normalizedContent || !userId) return null;

  const allNotes = readRawNotes(userId);
  const normalizedKey = String(idempotencyKey || '').trim();
  const duplicate = allNotes
    .map((item) => normalizeNote(item, userId))
    .find((item) => item.userId === (userId || null) && (
      (normalizedKey && item.idempotencyKey === normalizedKey)
      || (item.status === 'aguardando_organizacao' && item.content === normalizedContent)
    ));
  if (duplicate) return duplicate;

  const note = normalizeNote({
    content: normalizedContent,
    source,
    status: 'aguardando_organizacao',
    createdAt: new Date().toISOString(),
    updatedAt: null,
    project,
    projectCandidate,
    idempotencyKey: normalizedKey,
    userId
  }, userId);

  allNotes.push(note);
  writeRawNotes(allNotes, userId);
  queueRemoteUpsert(note);
  return note;
}

export function updateUnsortedNote(noteId, updates, userId = null) {
  if (!userId) return null;
  const allNotes = readRawNotes(userId);
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
  writeRawNotes(allNotes, userId);
  queueRemoteUpsert(updated);
  return updated;
}

export function removeUnsortedNote(noteId, userId = null) {
  if (!userId) return false;
  const allNotes = readRawNotes(userId);
  const next = allNotes.filter((note) => !(note?.id === noteId && (!userId || note?.userId === userId)));
  if (next.length === allNotes.length) return false;

  writeRawNotes(next, userId);
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    integratedAiClient.fetch(`/records/${REMOTE_COLLECTION}/${encodeURIComponent(noteId)}`, { method: 'DELETE' })
      .catch((error) => {
        if (error?.status !== 404) return null;
        return null;
      });
  }
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

export function formatSavedWaitingTime(value, referenceDate = new Date()) {
  const savedDate = parseLocalDate(value);
  const today = parseLocalDate(referenceDate);
  if (!savedDate || !today) return 'Data não informada';
  const differenceDays = Math.round((today.getTime() - savedDate.getTime()) / 86400000);
  if (differenceDays <= 0) return 'Guardado hoje';
  if (differenceDays === 1) return 'Guardado ontem';
  if (differenceDays <= 6) return `Guardado há ${differenceDays} dias`;
  return `Guardado em ${savedDate.toLocaleDateString('pt-BR')}`;
}

export { UNSORTED_NOTES_STORAGE_KEY };
