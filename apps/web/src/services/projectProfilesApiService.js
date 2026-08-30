import { integratedAiClient } from '@/lib/integratedAiClient.js';

export async function listProjectProfilesApi() {
  const response = await integratedAiClient.fetch('/projects', { method: 'GET' });
  return Array.isArray(response?.items) ? response.items : [];
}

export async function createProjectProfileApi(payload = {}) {
  const response = await integratedAiClient.fetch('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response?.item || null;
}

export async function mergeProjectProfilesApi(source, target) {
  return integratedAiClient.fetch('/projects/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, target }),
  });
}

export async function updateProjectProfileApi(currentName, payload = {}) {
  const encoded = encodeURIComponent(String(currentName || '').trim());
  const response = await integratedAiClient.fetch(`/projects/${encoded}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response?.item || null;
}

export async function deleteProjectProfileApi(name) {
  const encoded = encodeURIComponent(String(name || '').trim());
  return integratedAiClient.fetch(`/projects/${encoded}`, { method: 'DELETE' });
}