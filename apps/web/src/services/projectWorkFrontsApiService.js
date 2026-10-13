import { integratedAiClient } from '@/lib/integratedAiClient.js';

function encodeProjectName(projectName) {
  return encodeURIComponent(String(projectName || '').trim());
}

export async function listProjectWorkFrontsApi(projectName) {
  const encodedProject = encodeProjectName(projectName);
  const response = await integratedAiClient.fetch(`/projects/${encodedProject}/work-fronts`, { method: 'GET' });
  return Array.isArray(response?.items) ? response.items : [];
}

export async function createProjectWorkFrontApi(projectName, payload = {}) {
  const encodedProject = encodeProjectName(projectName);
  const response = await integratedAiClient.fetch(`/projects/${encodedProject}/work-fronts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response?.item || null;
}

export async function updateProjectWorkFrontApi(projectName, frontId, payload = {}) {
  const encodedProject = encodeProjectName(projectName);
  const encodedFront = encodeURIComponent(String(frontId || '').trim());
  const response = await integratedAiClient.fetch(`/projects/${encodedProject}/work-fronts/${encodedFront}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response?.item || null;
}

export async function deleteProjectWorkFrontApi(projectName, frontId, payload = {}) {
  const encodedProject = encodeProjectName(projectName);
  const encodedFront = encodeURIComponent(String(frontId || '').trim());
  return integratedAiClient.fetch(`/projects/${encodedProject}/work-fronts/${encodedFront}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
