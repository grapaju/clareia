import { integratedAiClient } from '@/lib/integratedAiClient.js';

function normalizeText(value) {
  return String(value || '').trim();
}

function toQueryString(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    const normalized = normalizeText(value);
    if (normalized) search.set(key, normalized);
  });

  return search.toString();
}

export async function getGoogleDriveStatus() {
  return integratedAiClient.fetch('/google-drive/status', { method: 'GET' });
}

export async function getGoogleDriveConfigChecklist() {
  return integratedAiClient.fetch('/google-drive/config-checklist', { method: 'GET' });
}

export async function getGoogleDriveOAuthUserSetupStatus() {
  return integratedAiClient.fetch('/google-drive/oauth-user-setup-status', { method: 'GET' });
}

export async function getGoogleDriveAuthUrl(payload = {}) {
  const query = toQueryString({
    projectId: payload.projectId,
    projectName: payload.projectName,
    projectType: payload.projectType,
    returnTo: payload.returnTo || '/projects'
  });

  return integratedAiClient.fetch(`/google-drive/auth-url?${query}`, { method: 'GET' });
}

export async function getGoogleDriveProjectFolderConfig(projectId) {
  const query = toQueryString({ projectId });
  const response = await integratedAiClient.fetch(`/google-drive/project-folder?${query}`, { method: 'GET' });
  return response?.config || null;
}

export async function saveGoogleDriveProjectFolderConfig(payload = {}) {
  const response = await integratedAiClient.fetch('/google-drive/project-folder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return response?.config || null;
}

export async function bootstrapGoogleDriveProjectFolders(payload = {}) {
  return integratedAiClient.fetch('/google-drive/projects/bootstrap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

export async function disconnectGoogleDrive() {
  return integratedAiClient.fetch('/google-drive/disconnect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
}

export async function syncGoogleDriveDocument(payload = {}) {
  return integratedAiClient.fetch('/google-drive/documents/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

export async function testGoogleDriveConnection(payload = {}) {
  return integratedAiClient.fetch('/google-drive/test-connection', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

export async function saveGoogleDriveOAuthUserConfig(payload = {}) {
  return integratedAiClient.fetch('/google-drive/oauth-user-config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}
