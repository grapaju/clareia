import apiClient from '@/lib/apiClient.js';
import { appendProjectHistory } from '@/services/projectHistoryService.js';
import { readUserScopedJson, writeUserScopedJson } from '@/lib/userScopedStorage.js';
import { isFinanceWaitingReturn, normalizeWaitingReturnInput } from '@/lib/waitingReturnLogic.js';

const STORAGE_KEY = 'clareia_waiting_return_v1';
const REMOTE_COLLECTION = 'aguardandoRetorno';

function readAll() {
  const items = readUserScopedJson(STORAGE_KEY, []);
  return Array.isArray(items) ? items : [];
}

function writeAll(items) {
  writeUserScopedJson(STORAGE_KEY, items);
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
  const normalized = normalizeWaitingReturnInput(payload);
  if (!normalized) return null;
  const now = new Date().toISOString();
  const item = {
    id: uid(),
    ...normalized,
    status: normalizeStatus(normalized.status),
    createdAt: now,
    updatedAt: now
  };

  const items = readAll();
  items.push(item);
  writeAll(items);
  if (item.project) appendProjectHistory(item.project, 'Acompanhamento criado', item.waitingFor);
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

export async function deleteWaitingReturnEverywhere(id) {
  const item = readAll().find((candidate) => candidate.id === id);
  if (item?.cloudId && userIdOrNull()) {
    try {
      await apiClient.collection(REMOTE_COLLECTION).delete(item.cloudId, { $autoCancel: false });
    } catch (error) {
      if (error?.status !== 404) throw error;
    }
  }
  return deleteWaitingReturn(id);
}

function userIdOrNull() {
  return apiClient?.authStore?.model?.id || null;
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
    financeSource: String(record.financeSource || '').trim(),
    financeInvoiceId: String(record.financeInvoiceId || '').trim(),
    externalClientId: String(record.externalClientId || '').trim(),
    invoiceNumber: String(record.invoiceNumber || '').trim(),
    dueDate: String(record.dueDate || '').trim(),
    contextUrl: String(record.contextUrl || '').trim(),
    totalAmount: String(record.totalAmount || '').trim(),
    paidAmount: String(record.paidAmount || '').trim(),
    remainingAmount: String(record.remainingAmount || '').trim(),
    lastFinanceEventId: String(record.lastFinanceEventId || '').trim(),
    lastFinanceEventType: String(record.lastFinanceEventType || '').trim(),
    lastFinanceEventOccurredAt: String(record.lastFinanceEventOccurredAt || '').trim(),
    resolvedAt: String(record.resolvedAt || '').trim(),
    resolutionNote: String(record.resolutionNote || '').trim(),
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
    status: normalizeStatus(item.status),
    financeSource: item.financeSource || '',
    financeInvoiceId: item.financeInvoiceId || '',
    externalClientId: item.externalClientId || '',
    invoiceNumber: item.invoiceNumber || '',
    dueDate: item.dueDate || '',
    contextUrl: item.contextUrl || '',
    totalAmount: item.totalAmount || '',
    paidAmount: item.paidAmount || '',
    remainingAmount: item.remainingAmount || '',
    lastFinanceEventId: item.lastFinanceEventId || '',
    lastFinanceEventType: item.lastFinanceEventType || '',
    lastFinanceEventOccurredAt: item.lastFinanceEventOccurredAt || '',
    resolvedAt: item.resolvedAt || '',
    resolutionNote: item.resolutionNote || '',
  };
}

export async function updateWaitingReturnEverywhere(id, updates = {}) {
  const items = readAll();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;

  const current = items[index];
  if (isFinanceWaitingReturn(current)) {
    throw new Error('O status financeiro e atualizado automaticamente pelo FluxoCash.');
  }

  const updated = {
    ...current,
    ...updates,
    status: updates.status !== undefined ? normalizeStatus(updates.status) : current.status,
    updatedAt: new Date().toISOString(),
  };

  if (current.cloudId && userIdOrNull()) {
    const remote = await apiClient.collection(REMOTE_COLLECTION).update(
      current.cloudId,
      toRemote(updated, userIdOrNull()),
      { $autoCancel: false }
    );
    items[index] = fromRemote(remote);
  } else {
    items[index] = updated;
  }
  writeAll(items);

  if (!current.cloudId) await syncWaitingReturnsWithCloud();
  return readAll().find((item) => item.id === id) || null;
}

export async function syncWaitingReturnsWithCloud() {
  const userId = userIdOrNull();
  if (!userId) return false;

  try {
    const localItems = readAll();
    const remoteItems = await apiClient.collection(REMOTE_COLLECTION).getFullList({
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
          await apiClient.collection(REMOTE_COLLECTION).update(item.cloudId, payload, { $autoCancel: false });
        } catch {
          // Keep local as source of truth when update fails.
        }
      } else {
        try {
          const created = await apiClient.collection(REMOTE_COLLECTION).create(payload, { $autoCancel: false });
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
