import { readUserScopedJson } from '../lib/userScopedStorage.js';

const MATERIAL_STORAGE_KEYS = [
  'clareia_project_files_v1',
  'clareia_project_links_v1',
  'clareia_project_notes_v1',
];

export const PROJECT_MATERIALS_UPDATED_EVENT = 'clareia-project-materials-updated';

export function notifyProjectMaterialsUpdated() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(PROJECT_MATERIALS_UPDATED_EVENT));
  }
}

export function countProjectMaterialsToOrganize() {
  return listProjectMaterialsToOrganize().length;
}

export function listProjectMaterialsToOrganize() {
  return MATERIAL_STORAGE_KEYS.flatMap((storageKey) => {
    const items = readUserScopedJson(storageKey, []);
    if (!Array.isArray(items)) return [];
    return items.filter((item) => item?.organizationStatus === 'para_organizar');
  });
}

export function subscribeToProjectMaterials(callback) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener(PROJECT_MATERIALS_UPDATED_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(PROJECT_MATERIALS_UPDATED_EVENT, callback);
  };
}