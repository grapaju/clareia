const STORAGE_KEY = 'clareia_project_links_v1';
import { appendProjectHistory } from './projectHistoryService.js';
import { readUserScopedJson, writeUserScopedJson } from '../lib/userScopedStorage.js';

const LINK_TYPES = [
  'site',
  'painel/admin',
  'Google Drive',
  'Canva',
  'Figma',
  'Google Ads',
  'GitHub',
  'referencia',
  'outro'
];

function readAll() {
  const items = readUserScopedJson(STORAGE_KEY, []);
  return Array.isArray(items) ? items : [];
}

function writeAll(items) {
  writeUserScopedJson(STORAGE_KEY, items);
}

function uid(prefix = 'link') {
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

export function getProjectLinkTypes() {
  return [...LINK_TYPES];
}

export function listProjectLinks(projectName) {
  return readAll()
    .filter((item) => item.projectName === projectName)
    .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || a.title.localeCompare(b.title, 'pt-BR'));
}

export function listFavoriteProjectLinks(projectName, limit = 5) {
  return listProjectLinks(projectName).filter((item) => item.favorite).slice(0, limit);
}

export function createProjectLink(payload) {
  const now = new Date().toISOString();
  const item = {
    id: uid(),
    projectName: String(payload.projectName || '').trim(),
    title: String(payload.title || '').trim(),
    url: String(payload.url || '').trim(),
    type: String(payload.type || 'outro').trim(),
    description: String(payload.description || '').trim(),
    folder: String(payload.folder || '').trim(),
    favorite: Boolean(payload.favorite),
    storageProvider: payload.storageProvider || 'external_link',
    relatedTaskIds: toArray(payload.relatedTaskIds),
    createdAt: now,
    updatedAt: now
  };

  if (!item.projectName || !item.title || !item.url) return null;
  const items = readAll();
  items.push(item);
  writeAll(items);
  appendProjectHistory(item.projectName, 'Link salvo', item.title || item.url || 'Link');
  return item;
}

export function updateProjectLink(id, updates = {}) {
  const items = readAll();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const current = items[index];
  const updated = {
    ...current,
    ...updates,
    relatedTaskIds: updates.relatedTaskIds !== undefined ? toArray(updates.relatedTaskIds) : current.relatedTaskIds,
    updatedAt: new Date().toISOString()
  };

  items[index] = updated;
  writeAll(items);
  return updated;
}

export function deleteProjectLink(id) {
  const items = readAll();
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return false;
  writeAll(next);
  return true;
}

export function listTaskRelatedLinks(taskId) {
  if (!taskId) return [];
  return readAll().filter((item) => Array.isArray(item.relatedTaskIds) && item.relatedTaskIds.includes(taskId));
}
