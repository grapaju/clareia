import { readUserScopedJson, writeUserScopedJson } from '../lib/userScopedStorage.js';

const PROJECT_HISTORY_KEY = 'clareia_project_history_v1';

function readHistoryMap() {
  return readUserScopedJson(PROJECT_HISTORY_KEY, {});
}

function writeHistoryMap(map) {
  writeUserScopedJson(PROJECT_HISTORY_KEY, map);
}

export function appendProjectHistory(projectName, action, details = '') {
  const normalizedProject = String(projectName || '').trim();
  if (!normalizedProject) return false;

  const historyMap = readHistoryMap();
  const current = Array.isArray(historyMap[normalizedProject]) ? historyMap[normalizedProject] : [];
  const entry = {
    id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action: String(action || '').trim() || 'Atualização do projeto',
    details: String(details || '').trim(),
    createdAt: new Date().toISOString()
  };

  historyMap[normalizedProject] = [entry, ...current].slice(0, 200);
  writeHistoryMap(historyMap);
  return true;
}
