import integratedAiClient from '@/lib/integratedAiClient.js';

export async function listTasksFromApi() {
  const result = await integratedAiClient.fetch('/tasks', { method: 'GET' });
  return Array.isArray(result?.items) ? result.items : [];
}

export async function createTaskInApi(payload) {
  const result = await integratedAiClient.fetch('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return result?.item || null;
}

export async function updateTaskInApi(id, payload) {
  const result = await integratedAiClient.fetch(`/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return result?.item || null;
}

export async function completeTaskInApi(id, payload = {}) {
  const result = await integratedAiClient.fetch(`/tasks/${id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return {
    item: result?.item || null,
    alreadyCompleted: result?.alreadyCompleted === true,
    session: result?.session || null,
    alreadyRecorded: result?.alreadyRecorded === true,
  };
}

export async function deleteTaskInApi(id) {
  await integratedAiClient.fetch(`/tasks/${id}`, {
    method: 'DELETE',
  });
}

export async function listTaskNotesFromApi(taskId) {
  const result = await integratedAiClient.fetch(`/tasks/${taskId}/notes`, { method: 'GET' });
  return Array.isArray(result?.items) ? result.items : [];
}

export async function createTaskNoteInApi(taskId, payload) {
  const result = await integratedAiClient.fetch(`/tasks/${taskId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return result?.item || null;
}

export async function listFocusSessionsFromApi(taskId) {
  const result = await integratedAiClient.fetch(`/tasks/${taskId}/focus-sessions`, { method: 'GET' });
  return Array.isArray(result?.items) ? result.items : [];
}

export async function createFocusSessionInApi(taskId, payload) {
  const result = await integratedAiClient.fetch(`/tasks/${taskId}/focus-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return result?.item || null;
}
