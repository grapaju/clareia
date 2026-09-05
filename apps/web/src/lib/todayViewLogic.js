import { getTaskMicrotaskProgress, isTaskOpenStatus, normalizeTaskStatus, TASK_STATUS } from './taskExecution.js';
import { toIsoDate } from './localDate.js';

export const TODAY_GROUPS = Object.freeze([
  { key: 'overdue', label: 'Atrasadas', emptyLabel: 'Nenhuma tarefa atrasada.' },
  { key: 'today', label: 'Para hoje', emptyLabel: 'Nenhuma tarefa para hoje.' },
  { key: 'upcoming', label: 'Próximas', emptyLabel: 'Nenhuma tarefa próxima.' },
  { key: 'undated', label: 'Sem data', emptyLabel: 'Nenhuma tarefa sem data.' },
  { key: 'waiting', label: 'Aguardando retorno', emptyLabel: 'Nenhum item aguardando retorno.' },
  { key: 'routines', label: 'Rotinas', emptyLabel: 'Nenhuma rotina pendente.' },
]);

function taskDate(task) {
  return toIsoDate(task?.scheduledDate || task?.dataSugeridaExecucao || task?.dueDate || task?.dataLimite);
}

function isRoutine(task) {
  const frequency = normalized(task?.recurrenceFrequency);
  const recognizedFrequency = ['diaria', 'semanal', 'quinzenal', 'mensal', 'anual'].includes(frequency);
  return Boolean(
    task?.recurrenceRuleId
    || task?.recurrenceSeriesId
    || task?.routineId
    || task?.recurringTemplateId
    || task?.isRecurring === true
    || recognizedFrequency
  );
}

function isLegacyToday(task) {
  return String(task?.status || '').trim().toLocaleLowerCase('pt-BR') === 'hoje';
}

function completedOn(task, dateIso) {
  return normalizeTaskStatus(task?.status) === TASK_STATUS.CONCLUIDA
    && toIsoDate(task?.completedAt || task?.updated || task?.updatedAt) === dateIso;
}

function actionTextWithoutDuration(value = '') {
  return String(value).replace(/\s*\((?:apenas\s+)?(?:cerca\s+de\s+)?\d+\s*(?:min|minutos?)\)\s*$/i, '').trim();
}

function durationFromActionText(value = '') {
  const match = String(value).match(/\((?:apenas\s+)?(?:cerca\s+de\s+)?(\d+)\s*(?:min|minutos?)\)\s*$/i);
  return match ? Number(match[1]) : 0;
}

export function getTaskNextActionPresentation(task, focusBlockMinutes = 0) {
  const trustedMicrotasks = Array.isArray(task?.microtarefas)
    ? task.microtarefas.filter((item) => !item?.taskId || !task?.id || item.taskId === task.id)
    : [];
  const progress = getTaskMicrotaskProgress({ ...task, microtarefas: trustedMicrotasks });
  const pendingStep = progress.nextPending;
  const rawAction = pendingStep?.title || task?.nextAction || task?.firstAction || '';
  const action = actionTextWithoutDuration(rawAction)
    || (String(task?.title || '').toLocaleLowerCase('pt-BR').includes('whatsapp')
      ? 'Abrir a conversa relacionada e localizar o pedido.'
      : 'Abrir a tarefa e identificar o primeiro passo concreto.');
  const actionMinutes = Number(
    pendingStep?.estimatedMinutes
    || task?.nextActionMinutes
    || durationFromActionText(rawAction)
    || 0
  );
  const blockMinutes = Number(focusBlockMinutes || task?.focusBlockMinutes || 0);
  const pauseNote = normalized(task?.pauseNote) === normalized(action) ? '' : String(task?.pauseNote || '').trim();

  return {
    action,
    actionMinutes,
    blockMinutes: blockMinutes && blockMinutes !== actionMinutes ? blockMinutes : 0,
    pauseNote,
    progress,
  };
}

export function buildTodayGroups(tasks, referenceDate = new Date()) {
  const todayIso = toIsoDate(referenceDate);
  const groups = Object.fromEntries(TODAY_GROUPS.map(({ key }) => [key, []]));
  const completedToday = [];

  for (const task of Array.isArray(tasks) ? tasks : []) {
    if (completedOn(task, todayIso)) completedToday.push(task);
    if (!isTaskOpenStatus(task?.status)) continue;

    const status = normalizeTaskStatus(task.status);
    const date = taskDate(task);
    if (status === TASK_STATUS.AGUARDANDO_RETORNO) groups.waiting.push(task);
    else if (date && date < todayIso) groups.overdue.push(task);
    else if (date === todayIso || isLegacyToday(task)) groups.today.push(task);
    else if (date && date > todayIso) groups.upcoming.push(task);
    else if (isRoutine(task)) groups.routines.push(task);
    else groups.undated.push(task);
  }

  const openCount = Object.values(groups).reduce((sum, items) => sum + items.length, 0);
  return { groups, completedToday, openCount, todayIso };
}

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

function energyLevel(value) {
  const energy = normalized(value);
  if (energy.includes('baixa')) return 1;
  if (energy.includes('alta')) return 3;
  return 2;
}

function hasSignificantEnergyGap(task, checkIn) {
  return energyLevel(checkIn?.energia) === 1
    && energyLevel(task?.energiaNecessaria || task?.energyLevel || task?.energyNeeded) === 3;
}

export function taskMatchesTodayFilters(task, filters = {}) {
  const search = normalized(filters.search);
  if (search && !normalized(`${task.title || ''} ${task.project || ''} ${task.nextAction || ''}`).includes(search)) return false;
  if (filters.project && filters.project !== 'all' && (task.project || 'Pessoal') !== filters.project) return false;
  if (filters.energy && filters.energy !== 'all' && normalized(task.energiaNecessaria || task.energyLevel) !== normalized(filters.energy)) return false;
  if (filters.priority && filters.priority !== 'all' && normalized(task.priority || task.importance || task.urgency) !== normalized(filters.priority)) return false;

  const minutes = Number(task.timeEstimate || task.estimatedMinutes || 0);
  if (filters.duration === 'short' && minutes > 30) return false;
  if (filters.duration === 'medium' && (minutes <= 30 || minutes > 60)) return false;
  if (filters.duration === 'long' && minutes <= 60) return false;
  return true;
}

export function filterTodayGroups(groups, filters) {
  return Object.fromEntries(Object.entries(groups).map(([key, items]) => [
    key,
    items.filter((task) => taskMatchesTodayFilters(task, filters)),
  ]));
}

export function getTodaySummary(groups, guardedCount = 0, externalWaitingCount = 0) {
  return {
    overdue: groups.overdue.length,
    today: groups.today.length,
    upcoming: groups.upcoming.length,
    undated: groups.undated.length,
    waiting: groups.waiting.length + Number(externalWaitingCount || 0),
    routines: groups.routines.length,
    guarded: Number(guardedCount || 0),
  };
}

export function getOpenPlannedMinutes(groups) {
  return [...groups.overdue, ...groups.today].reduce(
    (sum, task) => sum + Number(task.timeEstimate || task.estimatedMinutes || 0),
    0
  );
}

export function getTodayCapacityState(plannedMinutes, availableMinutes) {
  const differenceMinutes = Number(plannedMinutes || 0) - Number(availableMinutes || 0);
  const remainingMinutes = Math.max(0, -differenceMinutes);
  const nearThreshold = Math.max(15, Math.round(Number(availableMinutes || 0) * 0.1));
  return {
    differenceMinutes,
    remainingMinutes,
    isExactCapacity: differenceMinutes === 0,
    isNearCapacity: differenceMinutes < 0 && remainingMinutes <= nearThreshold,
    isOverCapacity: differenceMinutes > 0,
  };
}

export function getTodayTaskSituation(task, referenceDate = new Date()) {
  const todayIso = toIsoDate(referenceDate);
  const date = taskDate(task);
  const routine = isRoutine(task);
  let label = 'Sem data';

  if (date && date < todayIso) label = 'Atrasada';
  else if (date === todayIso || isLegacyToday(task)) {
    const period = String(task?.scheduledPeriod || task?.periodoSugerido || '').toLocaleLowerCase('pt-BR');
    label = period.includes('manhã') || period.includes('manha')
      ? 'Hoje de manhã'
      : period.includes('noite') ? 'Hoje à noite' : period.includes('tarde') ? 'Hoje à tarde' : 'Hoje';
  } else if (date) {
    const tomorrow = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() + 1);
    label = date === toIsoDate(tomorrow)
      ? 'Amanhã'
      : new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR');
  }

  return { label, routine };
}

export function getTaskRowMetadata(task) {
  const progress = getTaskMicrotaskProgress(task);
  const situation = getTodayTaskSituation(task);
  return {
    date: taskDate(task),
    minutes: Number(task.timeEstimate || task.estimatedMinutes || 0),
    progress: progress.total ? `${progress.completed}/${progress.total}` : '',
    situation: situation.label,
    isRoutine: situation.routine,
  };
}

export function getVisibleTodayTasks(groups, recommendedId = '') {
  const byDate = (left, right) => (taskDate(left) || '9999-12-31').localeCompare(taskDate(right) || '9999-12-31');
  return [
    ...[...groups.overdue].sort(byDate),
    ...groups.today,
    ...groups.upcoming.filter((task) => !isRoutine(task)).sort(byDate),
    ...groups.undated,
    ...groups.routines,
  ].filter((task) => task.id !== recommendedId);
}

export function getTodayHighlight(tasks, recommendedTask = null, activeSession = null, checkIn = null) {
  const openTasks = Array.isArray(tasks) ? tasks.filter((task) => isTaskOpenStatus(task?.status)) : [];
  const recommendation = recommendedTask && openTasks.find((task) => task.id === recommendedTask.id);
  const compatibleRecommendation = recommendation && !hasSignificantEnergyGap(recommendation, checkIn)
    ? recommendation
    : null;
  const resolveContinuation = (task, reason) => {
    if (!task) return null;
    if (hasSignificantEnergyGap(task, checkIn) && compatibleRecommendation && compatibleRecommendation.id !== task.id) {
      return { task: compatibleRecommendation, reason: 'recommended' };
    }
    return { task, reason };
  };
  const activeTask = activeSession?.taskId
    ? openTasks.find((task) => task.id === activeSession.taskId)
    : null;
  if (activeTask) return resolveContinuation(activeTask, 'active_session');

  const pausedTask = openTasks.find((task) => normalizeTaskStatus(task.status) === TASK_STATUS.PAUSADA);
  if (pausedTask) return resolveContinuation(pausedTask, 'paused');

  const startedTask = openTasks.find((task) => {
    if (normalizeTaskStatus(task.status) !== TASK_STATUS.EM_ANDAMENTO) return false;
    return getTaskMicrotaskProgress(task).pending > 0;
  });
  if (startedTask) return resolveContinuation(startedTask, 'started');

  return recommendation ? { task: recommendation, reason: 'recommended' } : { task: null, reason: 'empty' };
}

export function getTodayPresentation(tasks, highlight, calmMode = false) {
  const highlightId = highlight?.task?.id || '';
  const remainingTasks = (Array.isArray(tasks) ? tasks : []).filter((task) => task.id !== highlightId);
  return {
    highlight: highlight?.task || null,
    visibleTasks: calmMode ? [] : remainingTasks,
  };
}