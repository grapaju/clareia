import pb from '@/lib/pocketbaseClient.js';
import { appendProjectHistory } from '@/services/projectHistoryService.js';

const STORAGE_KEY = 'clareia_waiting_return_v1';
const REMOTE_COLLECTION = 'aguardandoRetorno';

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

function uid(prefix = 'waiting') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStatus(status) {
  const value = String(status || '').trim();
  if (value === 'Concluido') return 'Concluido';
  if (value === 'Aguardando retorno') return 'Aguardando retorno';
  return 'Aguardando retorno';
}

export function listWaitingReturns() {
  return readAll().sort((a, b) => {
    const aDate = new Date(a.nextFollowUpDate || a.reminderDate || '2999-12-31').getTime();
    const bDate = new Date(b.nextFollowUpDate || b.reminderDate || '2999-12-31').getTime();
    return aDate - bDate;
  });
}

export function listProjectWaitingReturns(projectName) {
  return listWaitingReturns().filter((item) => item.project === projectName);
}

export function listFollowUpsForDate(targetDate) {
  if (!targetDate) return [];
  return listWaitingReturns().filter((item) => {
    const candidate = item.nextFollowUpDate || item.reminderDate;
    return candidate === targetDate && item.status !== 'Concluido';
  });
}

export function createWaitingReturn(payload) {
  const now = new Date().toISOString();
  const item = {
    id: uid(),
    title: String(payload.title || '').trim(),
    project: String(payload.project || '').trim(),
    contactName: String(payload.contactName || '').trim(),
    waitingFor: String(payload.waitingFor || '').trim(),
    lastContactDate: String(payload.lastContactDate || '').trim(),
    reminderDate: String(payload.reminderDate || '').trim(),
    nextFollowUp: String(payload.nextFollowUp || '').trim(),
    nextFollowUpDate: String(payload.nextFollowUpDate || '').trim(),
    observations: String(payload.observations || '').trim(),
    status: normalizeStatus(payload.status),
    createdAt: now,
    updatedAt: now
  };

  if (!item.title || !item.project || !item.contactName || !item.waitingFor) return null;

  const items = readAll();
  items.push(item);
  writeAll(items);
  appendProjectHistory(item.project, 'Acompanhamento criado', item.waitingFor || item.title || 'Aguardando retorno');
  return item;
}

export function updateWaitingReturn(id, updates = {}) {
  const items = readAll();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const current = items[index];
  const updated = {
    ...current,
    ...updates,
    status: updates.status !== undefined ? normalizeStatus(updates.status) : current.status,
    updatedAt: new Date().toISOString()
  };

  items[index] = updated;
  writeAll(items);
  return updated;
}

export function deleteWaitingReturn(id) {
  const items = readAll();
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) return false;
  writeAll(next);
  return true;
}

function userIdOrNull() {
  return pb?.authStore?.model?.id || null;
}

function fromRemote(record) {
  return {
    id: String(record.localId || record.id),
    cloudId: String(record.id),
    title: String(record.title || '').trim(),
    project: String(record.project || '').trim(),
    contactName: String(record.contactName || '').trim(),
    waitingFor: String(record.waitingFor || '').trim(),
    lastContactDate: String(record.lastContactDate || '').trim(),
    reminderDate: String(record.reminderDate || '').trim(),
    nextFollowUp: String(record.nextFollowUp || '').trim(),
    nextFollowUpDate: String(record.nextFollowUpDate || '').trim(),
    observations: String(record.observations || '').trim(),
    status: normalizeStatus(record.status),
    createdAt: record.created || new Date().toISOString(),
    updatedAt: record.updated || new Date().toISOString()
  };
}

function toRemote(item, userId) {
  return {
    userId,
    localId: item.id,
    title: item.title,
    project: item.project,
    contactName: item.contactName,
    waitingFor: item.waitingFor,
    lastContactDate: item.lastContactDate,
    reminderDate: item.reminderDate,
    nextFollowUp: item.nextFollowUp,
    nextFollowUpDate: item.nextFollowUpDate,
    observations: item.observations,
    status: normalizeStatus(item.status)
  };
}

export async function syncWaitingReturnsWithCloud() {
  const userId = userIdOrNull();
  if (!userId) return false;

  try {
    const localItems = readAll();
    const remoteItems = await pb.collection(REMOTE_COLLECTION).getFullList({
      filter: `userId = "${userId}"`,
      sort: '-updated',
      $autoCancel: false
    });

    const byLocalId = new Map(localItems.map((item) => [item.id, item]));
    const byCloudId = new Map(localItems.map((item) => [item.cloudId, item]));

    const merged = [...localItems];

    for (const remote of remoteItems) {
      const remoteNormalized = fromRemote(remote);
      const existing = byCloudId.get(remote.id) || byLocalId.get(remoteNormalized.id);
      if (!existing) {
        merged.push(remoteNormalized);
        continue;
      }

      const index = merged.findIndex((item) => item.id === existing.id);
      if (index >= 0) {
        merged[index] = {
          ...existing,
          ...remoteNormalized
        };
      }
    }

    for (const item of merged) {
      const payload = toRemote(item, userId);
      if (item.cloudId) {
        try {
          await pb.collection(REMOTE_COLLECTION).update(item.cloudId, payload, { $autoCancel: false });
        } catch {
          // Keep local as source of truth when update fails.
        }
      } else {
        try {
          const created = await pb.collection(REMOTE_COLLECTION).create(payload, { $autoCancel: false });
          item.cloudId = created.id;
        } catch {
          // Keep local only when create fails.
        }
      }
    }

    writeAll(merged);
    return true;
  } catch {
    return false;
  }
}
