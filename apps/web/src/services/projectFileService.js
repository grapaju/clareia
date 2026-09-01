const STORAGE_KEY = 'clareia_project_files_v1';
import { appendProjectHistory } from '@/services/projectHistoryService.js';
import { readUserScopedJson, writeUserScopedJson } from '../lib/userScopedStorage.js';

function readAll() {
  const items = readUserScopedJson(STORAGE_KEY, []);
  return Array.isArray(items) ? items : [];
}

function writeAll(items) {
  writeUserScopedJson(STORAGE_KEY, items);
}

function uid(prefix = 'file') {
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

export function listProjectFiles(projectName) {
  return readAll()
    .filter((item) => item.projectName === projectName)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function listRecentProjectFiles(projectName, limit = 5) {
  return listProjectFiles(projectName).slice(0, limit);
}

export function createProjectFile(payload) {
  const now = new Date().toISOString();
  const item = {
    id: uid(),
    projectId: String(payload.projectId || payload.projectName || '').trim(),
    projectName: String(payload.projectName || '').trim(),
    folderId: String(payload.folderId || '').trim(),
    name: String(payload.name || '').trim(),
    type: String(payload.type || '').trim(),
    folder: String(payload.folder || '').trim(),
    provider: String(payload.provider || payload.storageProvider || 'local').trim(),
    driveFileId: String(payload.driveFileId || '').trim(),
    driveFolderId: String(payload.driveFolderId || '').trim(),
    url: String(payload.url || payload.externalLink || '').trim(),
    description: String(payload.description || '').trim(),
    tags: toArray(payload.tags),
    origin: String(payload.origin || '').trim(),
    externalLink: String(payload.externalLink || '').trim(),
    storageProvider: payload.storageProvider || 'local',
    relatedTaskId: String(payload.relatedTaskId || '').trim(),
    relatedTaskIds: toArray(payload.relatedTaskIds),
    createdAt: now,
    updatedAt: now
  };

  if (!item.projectName && item.projectId) {
    item.projectName = item.projectId;
  }
  if (!item.projectId && item.projectName) {
    item.projectId = item.projectName;
  }
  if (!item.externalLink && item.url) {
    item.externalLink = item.url;
  }
  if (!item.url && item.externalLink) {
    item.url = item.externalLink;
  }
  if (!item.storageProvider && item.provider) {
    item.storageProvider = item.provider;
  }
  if (!item.provider && item.storageProvider) {
    item.provider = item.storageProvider;
  }
  if (!item.relatedTaskId && item.relatedTaskIds.length > 0) {
    item.relatedTaskId = String(item.relatedTaskIds[0] || '').trim();
  }
  if (!item.relatedTaskIds.length && item.relatedTaskId) {
    item.relatedTaskIds = [item.relatedTaskId];
  }

  if (!item.projectName || !item.name) return null;
  const items = readAll();
  items.push(item);
  writeAll(items);
  appendProjectHistory(item.projectName, 'Arquivo adicionado', item.name || 'Arquivo');
  return item;
}

export function updateProjectFile(id, updates = {}) {
  const items = readAll();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const current = items[index];
  const updated = {
    ...current,
    ...updates,
    projectId: updates.projectId !== undefined ? String(updates.projectId || '').trim() : String(current.projectId || current.projectName || '').trim(),
    projectName: updates.projectName !== undefined ? String(updates.projectName || '').trim() : String(current.projectName || current.projectId || '').trim(),
    folderId: updates.folderId !== undefined ? String(updates.folderId || '').trim() : String(current.folderId || '').trim(),
    provider: updates.provider !== undefined ? String(updates.provider || '').trim() : String(current.provider || current.storageProvider || 'local').trim(),
    driveFileId: updates.driveFileId !== undefined ? String(updates.driveFileId || '').trim() : String(current.driveFileId || '').trim(),
    driveFolderId: updates.driveFolderId !== undefined ? String(updates.driveFolderId || '').trim() : String(current.driveFolderId || '').trim(),
    url: updates.url !== undefined ? String(updates.url || '').trim() : String(current.url || current.externalLink || '').trim(),
    tags: updates.tags !== undefined ? toArray(updates.tags) : current.tags,
    relatedTaskId: updates.relatedTaskId !== undefined ? String(updates.relatedTaskId || '').trim() : String(current.relatedTaskId || current.relatedTaskIds?.[0] || '').trim(),
    relatedTaskIds: updates.relatedTaskIds !== undefined ? toArray(updates.relatedTaskIds) : current.relatedTaskIds,
    updatedAt: new Date().toISOString()
  };

  if (!updated.projectName && updated.projectId) {
    updated.projectName = updated.projectId;
  }
  if (!updated.projectId && updated.projectName) {
    updated.projectId = updated.projectName;
  }

  if (!updated.externalLink && updated.url) {
    updated.externalLink = updated.url;
  }
  if (!updated.url && updated.externalLink) {
    updated.url = updated.externalLink;
  }

  if (!updated.storageProvider && updated.provider) {
    updated.storageProvider = updated.provider;
  }
  if (!updated.provider && updated.storageProvider) {
    updated.provider = updated.storageProvider;
  }

  if (!updated.relatedTaskId && Array.isArray(updated.relatedTaskIds) && updated.relatedTaskIds.length > 0) {
    updated.relatedTaskId = String(updated.relatedTaskIds[0] || '').trim();
  }
  if ((!Array.isArray(updated.relatedTaskIds) || !updated.relatedTaskIds.length) && updated.relatedTaskId) {
    updated.relatedTaskIds = [updated.relatedTaskId];
  }

  items[index] = updated;
  writeAll(items);
  return updated;
}

export function deleteProjectFile(id) {
  const items = readAll();
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return false;
  writeAll(next);
  return true;
}

export function listTaskRelatedFiles(taskId) {
  if (!taskId) return [];
  return readAll().filter((item) => Array.isArray(item.relatedTaskIds) && item.relatedTaskIds.includes(taskId));
}
