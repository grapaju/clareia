function stripAccents(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export const TASK_STATUS = {
  PENDENTE: 'pendente',
  EM_ANDAMENTO: 'em_andamento',
  PAUSADA: 'pausada',
  CONCLUIDA: 'concluida',
  AGUARDANDO_RETORNO: 'aguardando_retorno',
  ARQUIVADA: 'arquivada'
};

export function normalizeTaskStatus(status) {
  const text = stripAccents(status);

  if (!text) return TASK_STATUS.PENDENTE;
  if (text === 'em_andamento' || text.includes('fazendo') || text.includes('em andamento')) return TASK_STATUS.EM_ANDAMENTO;
  if (text.includes('pausad')) return TASK_STATUS.PAUSADA;
  if (text.includes('concluid') || text === 'completed' || text === 'done') return TASK_STATUS.CONCLUIDA;
  if (text === 'aguardando_retorno' || text.includes('aguardando retorno')) return TASK_STATUS.AGUARDANDO_RETORNO;
  if (text.includes('arquivad') || text.includes('backlog')) return TASK_STATUS.ARQUIVADA;

  if (
    text.includes('hoje') ||
    text.includes('esta semana') ||
    text.includes('proxima semana') ||
    text.includes('pendente') ||
    text.includes('adiado')
  ) {
    return TASK_STATUS.PENDENTE;
  }

  return TASK_STATUS.PENDENTE;
}

export function isTaskCompletedStatus(status) {
  return normalizeTaskStatus(status) === TASK_STATUS.CONCLUIDA;
}

export function isTaskArchivedStatus(status) {
  return normalizeTaskStatus(status) === TASK_STATUS.ARQUIVADA;
}

export function isTaskPausedStatus(status) {
  return normalizeTaskStatus(status) === TASK_STATUS.PAUSADA;
}

export function isTaskOpenStatus(status) {
  const normalized = normalizeTaskStatus(status);
  return normalized !== TASK_STATUS.CONCLUIDA && normalized !== TASK_STATUS.ARQUIVADA;
}

export function isTaskActionableStatus(status) {
  const normalized = normalizeTaskStatus(status);
  return normalized === TASK_STATUS.PENDENTE || normalized === TASK_STATUS.EM_ANDAMENTO;
}

function microtaskId(raw, index) {
  const id = String(raw?.id || '').trim();
  if (id) return id;
  return `micro-${index + 1}`;
}

export function normalizeMicrotasks(microtasks, taskId = '') {
  if (!Array.isArray(microtasks)) return [];

  return microtasks
    .map((item, index) => {
      const title = String(item?.title || item?.descricao || '').trim();
      const completed = Boolean(item?.completed) || stripAccents(item?.status) === 'concluida';
      const completedAt = completed ? (item?.completedAt || item?.updatedAt || null) : null;
      const orderIndex = Number.isFinite(Number(item?.orderIndex)) ? Number(item.orderIndex) : index;
      const id = microtaskId(item, index);

      return {
        ...item,
        id,
        taskId: String(item?.taskId || taskId || '').trim(),
        title,
        completed,
        completedAt,
        orderIndex,
        descricao: title,
        status: completed ? 'concluída' : 'não iniciada'
      };
    })
    .sort((a, b) => Number(a.orderIndex || 0) - Number(b.orderIndex || 0));
}

export function getTaskMicrotaskProgress(task) {
  const normalized = normalizeMicrotasks(task?.microtarefas, task?.id || '');
  const completedItems = normalized.filter((item) => item.completed);
  const nextPending = normalized.find((item) => !item.completed) || null;

  return {
    normalized,
    total: normalized.length,
    completed: completedItems.length,
    pending: Math.max(0, normalized.length - completedItems.length),
    nextPending
  };
}

export function hasPendingMicrotasks(task) {
  const { total, pending } = getTaskMicrotaskProgress(task);
  return total > 0 && pending > 0;
}

export function completeAllMicrotasks(task, completedAt = new Date().toISOString()) {
  const { normalized } = getTaskMicrotaskProgress(task);
  return normalized.map((item) => ({
    ...item,
    completed: true,
    completedAt,
    status: 'concluída'
  }));
}

export function upsertMicrotaskCompletion(microtasks, id, checked, taskId = '') {
  const now = new Date().toISOString();
  return normalizeMicrotasks(microtasks, taskId).map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      completed: Boolean(checked),
      completedAt: checked ? now : null,
      status: checked ? 'concluída' : 'não iniciada'
    };
  });
}

export function getTaskWorkedMinutes(taskId, sessions = []) {
  if (!taskId) return 0;
  return sessions
    .filter((session) => session.taskId === taskId)
    .reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);
}
