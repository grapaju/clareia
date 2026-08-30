const STORAGE_KEY = 'clareia_task_history';

function safeParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function readAll() {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY), []);
}

export function listAllTaskHistory() {
  return readAll().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function writeAll(items) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function uid(prefix = 'th') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function addTaskHistoryEvent(payload = {}) {
  const item = {
    id: uid(),
    taskId: String(payload.taskId || '').trim(),
    projectId: String(payload.projectId || '').trim() || 'Pessoal',
    type: String(payload.type || '').trim() || 'task_event',
    message: String(payload.message || '').trim() || 'Evento da tarefa',
    createdAt: new Date().toISOString()
  };

  if (!item.taskId) return null;

  const items = readAll();
  items.push(item);
  writeAll(items);
  return item;
}

export function listTaskHistory(taskId) {
  const id = String(taskId || '').trim();
  if (!id) return [];
  return readAll()
    .filter((item) => item.taskId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function listTaskHistoryByProject(projectId) {
  const id = String(projectId || '').trim();
  return readAll()
    .filter((item) => item.projectId === id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function reassignTaskHistoryProject(sourceProjectId, targetProjectId) {
  const source = String(sourceProjectId || '').trim();
  const target = String(targetProjectId || '').trim();
  if (!source || !target || source === target) return 0;

  const items = readAll();
  let moved = 0;
  const updated = items.map((item) => {
    if (String(item.projectId || '').trim() !== source) return item;
    moved += 1;
    return { ...item, projectId: target };
  });
  if (moved > 0) writeAll(updated);
  return moved;
}

export function getTaskLastCompletionDate(taskId) {
  return listTaskHistory(taskId).find((item) => item.type === 'task_completed')?.createdAt || null;
}
