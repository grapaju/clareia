function toLocalDate(value) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addOneMonth(date) {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + 1);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

export function getNextRecurringDate(task) {
  const frequency = task?.recurrenceFrequency;
  const baseDate = toLocalDate(task?.recurrenceAnchorDate || task?.scheduledDate || task?.dataSugeridaExecucao);

  if (frequency === 'Semanal') {
    baseDate.setDate(baseDate.getDate() + 7);
    return toIsoDate(baseDate);
  }

  if (frequency === 'Mensal') {
    return toIsoDate(addOneMonth(baseDate));
  }

  return null;
}

export function getStatusForScheduledDate(dateValue) {
  toLocalDate(dateValue);
  return 'pendente';
}

export function resetMicrotasks(microtasks) {
  if (!Array.isArray(microtasks)) return [];
  return microtasks.map((microtask, index) => {
    const title = microtask?.title || microtask?.descricao || '';
    return {
      ...microtask,
      id: microtask?.id || `micro-${index + 1}`,
      taskId: microtask?.taskId || '',
      title,
      completed: false,
      completedAt: null,
      orderIndex: Number.isFinite(Number(microtask?.orderIndex)) ? Number(microtask.orderIndex) : index,
      descricao: title,
      status: 'não iniciada'
    };
  });
}

function safeIso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return toIsoDate(parsed);
}

export function mapTaskToRecurringTask(task) {
  return {
    id: task?.id,
    title: task?.title || 'Rotina sem título',
    projectId: task?.project || 'Pessoal',
    frequency: task?.recurrenceFrequency === 'Semanal' ? 'weekly' : (task?.recurrenceFrequency === 'Mensal' ? 'monthly' : 'none'),
    interval: 1,
    nextRunDate: safeIso(task?.scheduledDate || task?.dataSugeridaExecucao),
    lastRunDate: safeIso(task?.completedAt || task?.updated || task?.updatedAt),
    estimatedMinutes: Number(task?.timeEstimate || task?.estimatedMinutes || 30),
    energyRequired: task?.energiaNecessaria || 'Média',
    isActive: ['Semanal', 'Mensal'].includes(task?.recurrenceFrequency),
    createdAt: task?.created || task?.createdAt || null
  };
}

export function mapTaskToTaskInstance(task) {
  return {
    id: task?.id,
    recurringTaskId: ['Semanal', 'Mensal'].includes(task?.recurrenceFrequency) ? task?.id : null,
    title: task?.title || 'Tarefa sem título',
    projectId: task?.project || 'Pessoal',
    scheduledDate: safeIso(task?.scheduledDate || task?.dataSugeridaExecucao),
    status: task?.status || 'pendente',
    createdAt: task?.created || task?.createdAt || null,
    completedAt: task?.completedAt || null
  };
}