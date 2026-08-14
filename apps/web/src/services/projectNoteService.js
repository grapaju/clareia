const STORAGE_KEY = 'clareia_project_notes_v1';
import { appendProjectHistory } from '@/services/projectHistoryService.js';

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

function uid(prefix = 'note') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function listProjectNotes(projectName) {
  return readAll()
    .filter((item) => item.projectName === projectName)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function listRecentProjectNotes(projectName, limit = 5) {
  return listProjectNotes(projectName).slice(0, limit);
}

export function createProjectNote(payload) {
  const now = new Date().toISOString();
  const item = {
    id: uid(),
    projectName: String(payload.projectName || '').trim(),
    title: String(payload.title || '').trim(),
    content: String(payload.content || '').trim(),
    tags: toArray(payload.tags),
    relatedTaskIds: toArray(payload.relatedTaskIds),
    createdAt: now,
    updatedAt: now
  };

  if (!item.projectName || !item.content) return null;
  const items = readAll();
  items.push(item);
  writeAll(items);
  appendProjectHistory(item.projectName, 'Nota adicionada', item.title || 'Nota sem título');
  return item;
}

export function updateProjectNote(id, updates = {}) {
  const items = readAll();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const current = items[index];
  const updated = {
    ...current,
    ...updates,
    tags: updates.tags !== undefined ? toArray(updates.tags) : current.tags,
    relatedTaskIds: updates.relatedTaskIds !== undefined ? toArray(updates.relatedTaskIds) : current.relatedTaskIds,
    updatedAt: new Date().toISOString()
  };

  items[index] = updated;
  writeAll(items);
  return updated;
}

export function deleteProjectNote(id) {
  const items = readAll();
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return false;
  writeAll(next);
  return true;
}

export function listTaskRelatedNotes(taskId) {
  if (!taskId) return [];
  return readAll().filter((item) => Array.isArray(item.relatedTaskIds) && item.relatedTaskIds.includes(taskId));
}
