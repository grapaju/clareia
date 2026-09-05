import { addTaskHistoryEvent } from './taskHistoryService.js';
import { readUserScopedJson, removeUserScopedItem, writeUserScopedJson } from '../lib/userScopedStorage.js';

const STORAGE_KEY = 'clareia_work_sessions';
const ACTIVE_TIMER_KEY = 'clareia_active_work_session';
const TIMER_START_LOCK = 'clareia-work-session-start';
let startInFlight = null;

function readAll() {
  return readUserScopedJson(STORAGE_KEY, []);
}

function writeAll(items) {
  writeUserScopedJson(STORAGE_KEY, items);
}

function uid(prefix = 'ws') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProjectId(projectId) {
  const value = String(projectId || '').trim();
  return value || 'Pessoal';
}

function minutesBetween(startedAt, endedAt) {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (!start || !end || end <= start) return 0;
  return Math.max(1, Math.round((end - start) / 60000));
}

function readActiveSession() {
  return readUserScopedJson(ACTIVE_TIMER_KEY, null);
}

function writeActiveSession(session) {
  if (!session) {
    removeUserScopedItem(ACTIVE_TIMER_KEY);
    return;
  }
  writeUserScopedJson(ACTIVE_TIMER_KEY, session);
}

export function stopUserWorkTimer(userId) {
  removeUserScopedItem(ACTIVE_TIMER_KEY, userId);
}

export function getActiveWorkSession() {
  return readActiveSession();
}

export function listWorkSessions() {
  return readAll().sort((a, b) => new Date(b.startedAt || b.createdAt || 0).getTime() - new Date(a.startedAt || a.createdAt || 0).getTime());
}

export function listProjectWorkSessions(projectId) {
  const normalized = normalizeProjectId(projectId);
  return listWorkSessions().filter((session) => normalizeProjectId(session.projectId) === normalized);
}

export function reassignProjectWorkSessions(sourceProjectId, targetProjectId) {
  const source = normalizeProjectId(sourceProjectId);
  const target = normalizeProjectId(targetProjectId);
  if (source === target) return 0;

  const items = readAll();
  let moved = 0;
  const updated = items.map((session) => {
    if (normalizeProjectId(session.projectId) !== source) return session;
    moved += 1;
    return { ...session, projectId: target };
  });
  if (moved > 0) writeAll(updated);

  const active = readActiveSession();
  if (active && normalizeProjectId(active.projectId) === source) {
    writeActiveSession({ ...active, projectId: target });
  }
  return moved;
}

function createOrReuseTimerWorkSession(payload = {}) {
  const existing = readActiveSession();
  if (existing?.id) {
    return existing;
  }

  const now = new Date().toISOString();
  const session = {
    id: uid(),
    projectId: normalizeProjectId(payload.projectId),
    taskId: payload.taskId || null,
    title: String(payload.title || '').trim() || 'Sessão de foco',
    startedAt: now,
    endedAt: null,
    durationMinutes: 0,
    source: 'timer',
    notes: String(payload.notes || '').trim(),
    createdAt: now
  };

  const items = readAll();
  items.push(session);
  writeAll(items);
  writeActiveSession({ id: session.id, taskId: session.taskId, projectId: session.projectId, startedAt: session.startedAt });

  if (session.taskId) {
    addTaskHistoryEvent({
      taskId: session.taskId,
      projectId: session.projectId,
      type: 'work_session_started',
      message: 'Sessão de trabalho iniciada'
    });
  }

  return session;
}

export async function startTimerWorkSession(payload = {}) {
  if (startInFlight) return startInFlight;

  const start = () => createOrReuseTimerWorkSession(payload);
  const operation = globalThis.navigator?.locks?.request
    ? globalThis.navigator.locks.request(TIMER_START_LOCK, start)
    : Promise.resolve().then(start);

  startInFlight = operation;
  try {
    return await operation;
  } finally {
    if (startInFlight === operation) startInFlight = null;
  }
}

export function finishWorkSession(sessionId, updates = {}) {
  const items = readAll();
  const index = items.findIndex((session) => session.id === sessionId);
  if (index < 0) return null;

  const current = items[index];
  const endedAt = updates.endedAt || new Date().toISOString();
  const durationMinutes = updates.durationMinutes || minutesBetween(current.startedAt, endedAt);

  const updated = {
    ...current,
    ...updates,
    endedAt,
    durationMinutes,
    notes: updates.notes !== undefined ? String(updates.notes || '').trim() : current.notes
  };

  items[index] = updated;
  writeAll(items);

  const active = readActiveSession();
  if (active?.id === sessionId) {
    writeActiveSession(null);
  }

  if (updated.taskId) {
    addTaskHistoryEvent({
      taskId: updated.taskId,
      projectId: updated.projectId,
      type: 'work_session_finished',
      message: `Sessão finalizada (${updated.durationMinutes} min)`
    });
  }

  return updated;
}

export function finishActiveWorkSessionForTask(taskId, updates = {}) {
  const active = readActiveSession();
  if (!active?.id) return null;
  if (taskId && active.taskId && taskId !== active.taskId) return null;
  return finishWorkSession(active.id, updates);
}

export function addManualWorkSession(payload = {}) {
  const now = new Date().toISOString();
  const startedAt = payload.startedAt || payload.date || now;
  const durationMinutes = Number(payload.durationMinutes || 0);
  if (!durationMinutes || durationMinutes <= 0) return null;

  const session = {
    id: uid(),
    projectId: normalizeProjectId(payload.projectId),
    taskId: payload.taskId || null,
    title: String(payload.title || '').trim() || 'Tempo manual',
    startedAt,
    endedAt: new Date(new Date(startedAt).getTime() + durationMinutes * 60000).toISOString(),
    durationMinutes,
    source: 'manual',
    notes: String(payload.notes || '').trim(),
    createdAt: now
  };

  const items = readAll();
  items.push(session);
  writeAll(items);

  if (session.taskId) {
    addTaskHistoryEvent({
      taskId: session.taskId,
      projectId: session.projectId,
      type: 'manual_time_added',
      message: `Tempo manual adicionado (${session.durationMinutes} min)`
    });
  }

  return session;
}

export function updateWorkSession(id, updates = {}) {
  const items = readAll();
  const index = items.findIndex((session) => session.id === id);
  if (index < 0) return null;

  const current = items[index];
  const updated = {
    ...current,
    ...updates,
    projectId: updates.projectId !== undefined ? normalizeProjectId(updates.projectId) : current.projectId,
    title: updates.title !== undefined ? String(updates.title || '').trim() : current.title,
    notes: updates.notes !== undefined ? String(updates.notes || '').trim() : current.notes
  };

  if (updates.startedAt || updates.endedAt) {
    const startedAt = updates.startedAt || current.startedAt;
    const endedAt = updates.endedAt || current.endedAt;
    updated.durationMinutes = updates.durationMinutes || minutesBetween(startedAt, endedAt);
  }

  items[index] = updated;
  writeAll(items);
  return updated;
}

export function deleteWorkSession(id) {
  const items = readAll();
  const next = items.filter((session) => session.id !== id);
  if (next.length === items.length) return false;
  writeAll(next);

  const active = readActiveSession();
  if (active?.id === id) {
    writeActiveSession(null);
  }
  return true;
}

export function getWorkTimeSummary(projectId, referenceDate = new Date()) {
  const normalized = normalizeProjectId(projectId);
  const sessions = listWorkSessions().filter((session) => normalizeProjectId(session.projectId) === normalized);
  const ref = new Date(referenceDate);
  const today = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const weekStart = new Date(today);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - day);
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);

  const todayMinutes = sessions
    .filter((session) => new Date(session.startedAt) >= today)
    .reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);

  const weekMinutes = sessions
    .filter((session) => new Date(session.startedAt) >= weekStart)
    .reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);

  const monthMinutes = sessions
    .filter((session) => new Date(session.startedAt) >= monthStart)
    .reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);

  const totalMinutes = sessions.reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);

  return {
    todayMinutes,
    weekMinutes,
    monthMinutes,
    totalMinutes
  };
}

export function toHours(minutes) {
  const safe = Number(minutes || 0);
  return (safe / 60).toFixed(1);
}
