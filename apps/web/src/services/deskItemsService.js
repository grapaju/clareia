import { integratedAiClient } from '@/lib/integratedAiClient.js';

const saveStates = new Map();

function request(path, options = {}) {
  return integratedAiClient.fetch(`/desk-items${path}`, options);
}

function rememberRevision(item) {
  if (!item?.id) return item;
  const state = saveStates.get(item.id) || {};
  state.revision = item.revision;
  saveStates.set(item.id, state);
  return item;
}

export async function listDeskItems() {
  const response = await request('', { method: 'GET' });
  return (response?.items || []).map(rememberRevision);
}

export async function createDeskItem(payload) {
  const response = await request('', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return rememberRevision(response?.item);
}

export function queueDeskItemUpdate(id, patch) {
  const state = saveStates.get(id) || { revision: patch.revision || 1, pending: null, promise: null };
  state.pending = { ...(state.pending || {}), ...patch };
  delete state.pending.revision;
  saveStates.set(id, state);

  if (!state.promise) {
    state.promise = (async () => {
      let lastItem = null;
      while (state.pending) {
        const pending = state.pending;
        state.pending = null;
        try {
          const response = await request(`/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...pending, revision: state.revision }),
          });
          lastItem = response?.item;
          state.revision = lastItem?.revision ?? state.revision;
        } catch (error) {
          state.pending = { ...pending, ...(state.pending || {}) };
          throw error;
        }
      }
      return lastItem;
    })().finally(() => {
      state.promise = null;
    });
  }

  return state.promise;
}

export async function flushDeskItemUpdates() {
  for (const [id, state] of saveStates) {
    if (state.pending && !state.promise) queueDeskItemUpdate(id, {});
  }
  await Promise.all([...saveStates.values()].map((state) => state.promise).filter(Boolean));
}

export async function deleteDeskItem(id) {
  const response = await request(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return response?.item;
}

export async function restoreDeskItem(id) {
  const response = await request(`/${encodeURIComponent(id)}/restore`, { method: 'POST' });
  return rememberRevision(response?.item);
}

export async function listArchivedDeskItems() {
  const response = await request('/archived', { method: 'GET' });
  return (response?.items || []).map(rememberRevision);
}

export async function archiveDeskItem(id) {
  const response = await request(`/${encodeURIComponent(id)}/archive`, { method: 'POST' });
  return rememberRevision(response?.item);
}

export async function unarchiveDeskItem(id) {
  const response = await request(`/${encodeURIComponent(id)}/unarchive`, { method: 'POST' });
  return rememberRevision(response?.item);
}