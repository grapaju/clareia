const STORAGE_KEY = 'clareia_project_drive_config_v1';
import { readUserScopedJson, writeUserScopedJson } from '../lib/userScopedStorage.js';

function readAll() {
  const items = readUserScopedJson(STORAGE_KEY, []);
  return Array.isArray(items) ? items : [];
}

function writeAll(items) {
  writeUserScopedJson(STORAGE_KEY, items);
}

function normalizeText(value) {
  return String(value || '').trim();
}

function uid(prefix = 'pdc') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// FUTURO (integracao real):
// - login Google via OAuth
// - consentimento para acessar arquivos/pastas do usuario
// - criacao automatica de pastas/subpastas
// - upload/listagem de arquivos
// - persistencia de driveFileId/driveFolderId sincronizados com API Google Drive

export function extractDriveFolderId(url) {
  const value = normalizeText(url);
  if (!value) return '';

  const folderMatch = value.match(/\/folders\/([a-zA-Z0-9_-]+)/i);
  if (folderMatch?.[1]) return folderMatch[1];

  const idParamMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (idParamMatch?.[1]) return idParamMatch[1];

  return '';
}

export function getProjectDriveConfig(projectId) {
  const id = normalizeText(projectId);
  if (!id) return null;
  return readAll().find((item) => item.projectId === id) || null;
}

export function saveProjectDriveConfig(payload = {}) {
  const projectId = normalizeText(payload.projectId);
  if (!projectId) return null;

  const now = new Date().toISOString();
  const all = readAll();
  const index = all.findIndex((item) => item.projectId === projectId);
  const existing = index >= 0 ? all[index] : null;

  const driveFolderUrl = normalizeText(payload.driveFolderUrl);
  const driveFolderId = normalizeText(payload.driveFolderId) || extractDriveFolderId(driveFolderUrl);
  const folderName = normalizeText(payload.folderName);

  const config = {
    id: existing?.id || uid(),
    projectId,
    driveFolderUrl,
    driveFolderId,
    folderName,
    connectedAt: existing?.connectedAt || now,
    updatedAt: now,
    status: payload.status || existing?.status || 'conectado manualmente',
    connectionType: payload.connectionType || existing?.connectionType || 'manual'
  };

  if (index >= 0) {
    all[index] = config;
  } else {
    all.push(config);
  }

  writeAll(all);
  return config;
}

export function renameProjectDriveConfig(projectId, nextProjectId) {
  const current = normalizeText(projectId);
  const next = normalizeText(nextProjectId);
  if (!current || !next || current === next) return null;

  const all = readAll();
  const index = all.findIndex((item) => item.projectId === current);
  if (index < 0) return null;

  const updated = {
    ...all[index],
    projectId: next,
    updatedAt: new Date().toISOString()
  };
  all[index] = updated;
  writeAll(all);
  return updated;
}

export function deleteProjectDriveConfig(projectId) {
  const id = normalizeText(projectId);
  if (!id) return false;
  const all = readAll();
  const next = all.filter((item) => item.projectId !== id);
  if (next.length === all.length) return false;
  writeAll(next);
  return true;
}

export function getDriveDefaultSubfoldersByType(projectType) {
  const normalizedType = normalizeText(projectType).toLocaleLowerCase('pt-BR');

  if (normalizedType.includes('google ads')) {
    return [
      'Briefing',
      'Criativos',
      'Prints',
      'Relatorios',
      'Alteracoes realizadas',
      'Historico'
    ];
  }

  if (normalizedType.includes('sistema') || normalizedType.includes('crm')) {
    return [
      'Escopo',
      'Prints',
      'Documentacao',
      'Deploy',
      'Bugs',
      'Acessos',
      'Historico'
    ];
  }

  return [
    'Orcamentos',
    'Contratos',
    'Reunioes',
    'Propostas',
    'Documentos enviados',
    'Documentos recebidos',
    'Prints',
    'Historico'
  ];
}
