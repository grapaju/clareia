const STORAGE_KEY = 'clareia_project_accesses_v1';
import { appendProjectHistory } from './projectHistoryService.js';
import { readUserScopedJson, writeUserScopedJson } from '../lib/userScopedStorage.js';
import { withoutPlaintextPassword } from '../lib/projectAccessSecurity.js';

function readAll() {
  const items = readUserScopedJson(STORAGE_KEY, []);
  return Array.isArray(items) ? items : [];
}

function writeAll(items) {
  writeUserScopedJson(STORAGE_KEY, items);
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
  const safePayload = withoutPlaintextPassword(payload);
  const now = new Date().toISOString();
  const item = {
    id: uid(),
    projectName: String(safePayload.projectName || '').trim(),
    title: String(safePayload.title || '').trim(),
    platform: String(safePayload.platform || '').trim(),
    url: String(safePayload.url || '').trim(),
    username: String(safePayload.username || '').trim(),
    notes: String(safePayload.notes || '').trim(),
    folder: String(safePayload.folder || '').trim(),
    relatedTaskIds: toArray(safePayload.relatedTaskIds),
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

  const safeUpdates = withoutPlaintextPassword(updates);

  const updated = {
    ...items[index],
    ...safeUpdates,
    relatedTaskIds: safeUpdates.relatedTaskIds !== undefined ? toArray(safeUpdates.relatedTaskIds) : items[index].relatedTaskIds,
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
