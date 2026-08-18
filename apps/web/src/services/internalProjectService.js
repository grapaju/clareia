import { createProjectProfileApi } from '@/services/projectProfilesApiService.js';

function normalizeText(value) {
  return String(value || '').trim();
}

export function isClareiaInternalProject(projectName) {
  return normalizeText(projectName).toLocaleLowerCase('pt-BR') === 'clareia';
}

export function ensureClareiaInternalProject() {
  // Fire-and-forget: evita travar UX em telas que só precisam garantir existência.
  return createProjectProfileApi({
    name: 'Clareia',
    summary: 'Projeto interno para melhorias, bugs e evolucoes do sistema.',
    projectType: 'Administrativo'
  }).catch(() => null);
}
