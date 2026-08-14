const PROJECT_PROFILES_KEY = 'clareia_project_profiles_v1';

function safeParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function readProfiles() {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(PROJECT_PROFILES_KEY), []);
}

function writeProfiles(items) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROJECT_PROFILES_KEY, JSON.stringify(items));
}

export function isClareiaInternalProject(projectName) {
  return String(projectName || '').trim().toLocaleLowerCase('pt-BR') === 'clareia';
}

export function ensureClareiaInternalProject() {
  if (typeof window === 'undefined') return null;

  const current = readProfiles();
  const existing = current.find((item) => isClareiaInternalProject(item?.name));

  const timestamp = nowIso();
  const basePayload = {
    name: 'Clareia',
    summary: 'Projeto interno para melhorias, bugs e evolucoes do sistema.',
    projectType: 'Administrativo',
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (existing) {
    const next = current.map((item) => {
      if (!isClareiaInternalProject(item?.name)) return item;
      return {
        ...basePayload,
        ...item,
        name: 'Clareia',
        projectType: item?.projectType || 'Administrativo',
        summary: item?.summary || basePayload.summary,
        updatedAt: timestamp
      };
    });
    writeProfiles(next);
    return next.find((item) => isClareiaInternalProject(item?.name)) || null;
  }

  const next = [basePayload, ...current].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
  writeProfiles(next);
  return basePayload;
}
