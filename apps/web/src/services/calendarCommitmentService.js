const STORAGE_KEY = 'clareia_calendar_commitments_v1';

function safeParse(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readAll() {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function writeAll(items) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function uid(prefix = 'cc') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeString(value) {
  return String(value || '').trim();
}

export function listCalendarCommitments() {
  return readAll().sort((a, b) => {
    const aTs = new Date(`${a.date || '2999-12-31'}T${a.startTime || '23:59'}:00`).getTime();
    const bTs = new Date(`${b.date || '2999-12-31'}T${b.startTime || '23:59'}:00`).getTime();
    return aTs - bTs;
  });
}

export function createCalendarCommitment(payload = {}) {
  const item = {
    id: uid(),
    title: normalizeString(payload.title),
    projectId: normalizeString(payload.projectId) || 'Pessoal',
    date: normalizeString(payload.date),
    startTime: normalizeString(payload.startTime),
    endTime: normalizeString(payload.endTime),
    estimatedMinutes: Number(payload.estimatedMinutes || 0),
    status: normalizeString(payload.status) || 'Confirmado',
    notes: normalizeString(payload.notes),
    googleCalendarEventId: normalizeString(payload.googleCalendarEventId),
    externalCalendarProvider: normalizeString(payload.externalCalendarProvider),
    syncStatus: normalizeString(payload.syncStatus) || 'local_only',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!item.title || !item.date || !item.startTime) return null;

  const items = readAll();
  items.push(item);
  writeAll(items);
  return item;
}

export function updateCalendarCommitment(id, updates = {}) {
  const items = readAll();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const current = items[index];
  const updated = {
    ...current,
    ...updates,
    title: updates.title !== undefined ? normalizeString(updates.title) : current.title,
    projectId: updates.projectId !== undefined ? normalizeString(updates.projectId) || 'Pessoal' : current.projectId,
    date: updates.date !== undefined ? normalizeString(updates.date) : current.date,
    startTime: updates.startTime !== undefined ? normalizeString(updates.startTime) : current.startTime,
    endTime: updates.endTime !== undefined ? normalizeString(updates.endTime) : current.endTime,
    status: updates.status !== undefined ? normalizeString(updates.status) : current.status,
    notes: updates.notes !== undefined ? normalizeString(updates.notes) : current.notes,
    syncStatus: updates.syncStatus !== undefined ? normalizeString(updates.syncStatus) : current.syncStatus,
    googleCalendarEventId: updates.googleCalendarEventId !== undefined ? normalizeString(updates.googleCalendarEventId) : current.googleCalendarEventId,
    externalCalendarProvider: updates.externalCalendarProvider !== undefined ? normalizeString(updates.externalCalendarProvider) : current.externalCalendarProvider,
    updatedAt: new Date().toISOString()
  };

  items[index] = updated;
  writeAll(items);
  return updated;
}

export function deleteCalendarCommitment(id) {
  const items = readAll();
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return false;
  writeAll(next);
  return true;
}
