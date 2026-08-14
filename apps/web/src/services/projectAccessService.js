const STORAGE_KEY = 'clareia_project_accesses_v1';
import { appendProjectHistory } from '@/services/projectHistoryService.js';

// WARNING: Passwords are intentionally stored in plain text in localStorage only for temporary UX.
// Future backend integration must encrypt secrets server-side and never expose raw passwords in the client.

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

function uid(prefix = 'access') {
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

export function listProjectAccesses(projectName) {
  return readAll()
    .filter((item) => item.projectName === projectName)
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
}

export function createProjectAccess(payload) {
  const now = new Date().toISOString();
  const item = {
    id: uid(),
    projectName: String(payload.projectName || '').trim(),
    title: String(payload.title || '').trim(),
    platform: String(payload.platform || '').trim(),
    url: String(payload.url || '').trim(),
    username: String(payload.username || '').trim(),
    password: String(payload.password || ''),
    notes: String(payload.notes || '').trim(),
    relatedTaskIds: toArray(payload.relatedTaskIds),
    createdAt: now,
    updatedAt: now
  };

  if (!item.projectName || !item.title) return null;

  const items = readAll();
  items.push(item);
  writeAll(items);
  appendProjectHistory(item.projectName, 'Acesso cadastrado', item.title || 'Acesso');
  return item;
}

export function updateProjectAccess(id, updates = {}) {
  const items = readAll();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const updated = {
    ...items[index],
    ...updates,
    relatedTaskIds: updates.relatedTaskIds !== undefined ? toArray(updates.relatedTaskIds) : items[index].relatedTaskIds,
    updatedAt: new Date().toISOString()
  };

  items[index] = updated;
  writeAll(items);
  return updated;
}

export function deleteProjectAccess(id) {
  const items = readAll();
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return false;
  writeAll(next);
  return true;
}

export function listTaskRelatedAccesses(taskId) {
  if (!taskId) return [];
  return readAll().filter((item) => Array.isArray(item.relatedTaskIds) && item.relatedTaskIds.includes(taskId));
}
