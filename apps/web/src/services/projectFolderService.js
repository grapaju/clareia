const STORAGE_KEY = 'clareia_project_folders_v1';
import { readUserScopedJson, writeUserScopedJson } from '../lib/userScopedStorage.js';

function readAll() {
  const items = readUserScopedJson(STORAGE_KEY, []);
  return Array.isArray(items) ? items : [];
}

function writeAll(items) {
  writeUserScopedJson(STORAGE_KEY, items);
}

function uid(prefix = 'pf') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value) {
  return String(value || '').trim();
}

export const PROJECT_TYPE_OPTIONS = [
  'Site WordPress',
  'Site React',
  'Google Ads',
  'Sistema/CRM',
  'Cliente recorrente',
  'Evento',
  'Administrativo'
];

const TEMPLATE_FOLDERS = {
  'Site WordPress': [
    'Briefing',
    'Acessos',
    'Conteudo',
    'Imagens',
    'Layout e referencias',
    'Prints e ajustes',
    'Publicacao',
    'Manutencao'
  ],
  'Site React': [
    'Briefing',
    'Acessos',
    'Conteudo',
    'Componentes',
    'Imagens',
    'Layout e referencias',
    'Deploy',
    'Manutencao'
  ],
  'Google Ads': [
    'Briefing',
    'Campanhas',
    'Criativos',
    'Publicos',
    'Relatorios',
    'Alteracoes realizadas',
    'Prints',
    'Historico de otimizacoes'
  ],
  'Sistema/CRM': [
    'Escopo',
    'Telas',
    'Banco de dados',
    'Acessos',
    'Prints',
    'Bugs',
    'Deploy',
    'Documentacao'
  ],
  'Cliente recorrente': [
    'Acessos',
    'Contratos',
    'Faturas',
    'Reunioes',
    'Materiais recebidos',
    'Entregas',
    'Referencias',
    'Historico'
  ],
  'Evento': [
    'Escopo',
    'Cronograma',
    'Fornecedores',
    'Materiais',
    'Acessos',
    'Divulgacao',
    'Prints',
    'Historico'
  ],
  'Administrativo': [
    'Acessos',
    'Processos',
    'Documentos',
    'Relatorios',
    'Financeiro',
    'Historico'
  ]
};

export function getDefaultFoldersByType(projectType) {
  return [...(TEMPLATE_FOLDERS[projectType] || TEMPLATE_FOLDERS.Administrativo)];
}

export function listProjectFolders(projectName) {
  const key = normalizeText(projectName);
  return readAll()
    .filter((item) => item.projectName === key)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function createProjectFolder({ projectName, name, parentId }) {
  const normalizedProject = normalizeText(projectName);
  const normalizedName = normalizeText(name);
  const normalizedParentId = normalizeText(parentId) || '';
  if (!normalizedProject || !normalizedName) return null;

  const items = readAll();
  const alreadyExists = items.some(
    (item) =>
      item.projectName === normalizedProject &&
      String(item.parentId || '') === normalizedParentId &&
      item.name.toLowerCase() === normalizedName.toLowerCase()
  );
  if (alreadyExists) return null;

  const now = new Date().toISOString();
  const folder = {
    id: uid('folder'),
    projectName: normalizedProject,
    name: normalizedName,
    parentId: normalizedParentId || null,
    createdAt: now,
    updatedAt: now
  };

  items.push(folder);
  writeAll(items);
  return folder;
}

export function updateProjectFolder(folderId, updates = {}) {
  const items = readAll();
  const index = items.findIndex((item) => item.id === folderId);
  if (index < 0) return null;

  const updated = {
    ...items[index],
    ...updates,
    name: normalizeText(updates.name ?? items[index].name),
    parentId: updates.parentId !== undefined ? (normalizeText(updates.parentId) || null) : (items[index].parentId || null),
    updatedAt: new Date().toISOString()
  };

  items[index] = updated;
  writeAll(items);
  return updated;
}

export function deleteProjectFolder(folderId) {
  const items = readAll();
  const next = items.filter((item) => item.id !== folderId);
  if (next.length === items.length) return false;
  writeAll(next);
  return true;
}

export function ensureProjectTemplateFolders(projectName, projectType) {
  const defaults = getDefaultFoldersByType(projectType);
  const existing = listProjectFolders(projectName);
  const existingNames = new Set(existing.map((item) => item.name.toLowerCase()));

  const created = [];
  defaults.forEach((name) => {
    if (!existingNames.has(name.toLowerCase())) {
      const folder = createProjectFolder({ projectName, name });
      if (folder) created.push(folder);
    }
  });

  return created;
}
