import { isAllowedDayForTask } from '../services/calendarPreferencesService.js';
import { toIsoDate } from './localDate.js';
import { isTaskOperational, normalizeTaskStatus, TASK_STATUS } from './taskExecution.js';

export const PLANNING_CAPACITY_RATIO = 0.85;
export const DEADLINE_RISK_MESSAGE = 'Seu tempo disponível pode não ser suficiente para concluir esta tarefa antes do prazo.';

function normalized(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
}

function taskMinutes(task) {
  return Math.max(5, Number(task?.timeEstimate || task?.estimatedMinutes || 30));
}

function priorityWeight(task) {
  const value = normalized(`${task?.priority || ''} ${task?.priorityGroup || ''} ${task?.importance || ''} ${task?.urgency || ''}`);
  if (/maxima|critica|urgente/.test(value)) return 3;
  if (/alta|high/.test(value)) return 2;
  if (/baixa|podeesperar|pode esperar|low/.test(value)) return 0;
  return 1;
}

function energyLevel(task) {
  const value = normalized(task?.energiaNecessaria || task?.energyRequired || task?.energyLevel);
  if (value.includes('alta')) return 3;
  if (value.includes('baixa')) return 1;
  return 2;
}

function isPersonalTask(task) {
  return normalized(task?.taskType).includes('pessoal') || normalized(task?.project).includes('pessoal');
}

function isFixedTask(task) {
  return task?.fixed === true || task?.isFixed === true || task?.fixedTime === true || Boolean(task?.startTime);
}

function isPlanningCandidate(task) {
  if (!isTaskOperational(task)) return false;
  const status = normalizeTaskStatus(task?.status);
  return status === TASK_STATUS.PENDENTE || status === TASK_STATUS.EM_ANDAMENTO;
}

function compareTasks(left, right) {
  const leftDue = toIsoDate(left?.dueDate || left?.dataLimite) || '9999-12-31';
  const rightDue = toIsoDate(right?.dueDate || right?.dataLimite) || '9999-12-31';
  if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
  const priorityDifference = priorityWeight(right) - priorityWeight(left);
  if (priorityDifference) return priorityDifference;
  const startedDifference = Number(normalizeTaskStatus(right?.status) === TASK_STATUS.EM_ANDAMENTO)
    - Number(normalizeTaskStatus(left?.status) === TASK_STATUS.EM_ANDAMENTO);
  if (startedDifference) return startedDifference;
  const dependencyDifference = Number(Boolean(right?.dependencyResolved)) - Number(Boolean(left?.dependencyResolved));
  if (dependencyDifference) return dependencyDifference;
  const durationDifference = taskMinutes(left) - taskMinutes(right);
  if (durationDifference) return durationDifference;
  const personalDifference = Number(isPersonalTask(left)) - Number(isPersonalTask(right));
  if (personalDifference) return personalDifference;
  return String(left?.created || left?.createdAt || '').localeCompare(String(right?.created || right?.createdAt || ''));
}

function commitmentMinutes(commitment, dateIso) {
  if (Number(commitment?.estimatedMinutes) > 0) return Number(commitment.estimatedMinutes);
  if (!commitment?.startTime || !commitment?.endTime) return 30;
  const start = new Date(`${dateIso}T${commitment.startTime}:00`).getTime();
  const end = new Date(`${dateIso}T${commitment.endTime}:00`).getTime();
  return end > start ? Math.round((end - start) / 60000) : 30;
}

function dateSequence(startDate, days) {
  const start = new Date(startDate);
  start.setHours(12, 0, 0, 0);
  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    return date;
  });
}

export function calculateDailyCapacity({ availableMinutes = 0, plannedMinutes = 0, fixedMinutes = 0, planningBuffer = PLANNING_CAPACITY_RATIO } = {}) {
  const available = Math.max(0, Number(availableMinutes || 0));
  const capacityMinutes = Math.max(0, Math.floor(available * Number(planningBuffer || PLANNING_CAPACITY_RATIO)));
  const occupiedMinutes = Math.max(0, Number(plannedMinutes || 0)) + Math.max(0, Number(fixedMinutes || 0));
  return {
    availableMinutes: available,
    capacityMinutes,
    plannedMinutes: Math.max(0, Number(plannedMinutes || 0)),
    fixedMinutes: Math.max(0, Number(fixedMinutes || 0)),
    remainingMinutes: Math.max(0, capacityMinutes - occupiedMinutes),
    isOverCapacity: occupiedMinutes > capacityMinutes,
  };
}

export function canTaskFitInDay({ taskMinutes: minutes = 0, availableMinutes = 0, plannedMinutes = 0, fixedMinutes = 0, planningBuffer } = {}) {
  return Number(minutes || 0) <= calculateDailyCapacity({ availableMinutes, plannedMinutes, fixedMinutes, planningBuffer }).remainingMinutes;
}

export function selectTasksWithinDailyCapacity(tasks = [], options = {}) {
  const ordered = [...tasks].sort((left, right) => {
    if (left.id === options.preferredTaskId) return -1;
    if (right.id === options.preferredTaskId) return 1;
    return compareTasks(left, right);
  });
  const selected = [];
  let plannedMinutes = 0;
  for (const task of ordered) {
    const minutes = taskMinutes(task);
    if (!canTaskFitInDay({
      taskMinutes: minutes,
      availableMinutes: options.availableMinutes,
      plannedMinutes,
      fixedMinutes: options.fixedMinutes,
    })) continue;
    selected.push(task);
    plannedMinutes += minutes;
  }
  return {
    tasks: selected,
    plannedMinutes,
    capacity: calculateDailyCapacity({
      availableMinutes: options.availableMinutes,
      plannedMinutes,
      fixedMinutes: options.fixedMinutes,
    }),
  };
}

function buildDays({ startDate, horizonDays, availableMinutes, existingTasks, candidates, commitments, preferences }) {
  const candidateIds = new Set(candidates.map((task) => task.id));
  return dateSequence(startDate, horizonDays).map((date) => {
    const iso = toIsoDate(date);
    const scheduled = existingTasks.filter((task) => (
      !candidateIds.has(task.id)
      && isPlanningCandidate(task)
      && toIsoDate(task.scheduledDate || task.dataSugeridaExecucao) === iso
    ));
    const fixedMinutes = commitments
      .filter((item) => toIsoDate(item.date) === iso)
      .reduce((sum, item) => sum + commitmentMinutes(item, iso), 0);
    return {
      date,
      iso,
      availableMinutes: typeof availableMinutes === 'function' ? Number(availableMinutes(iso)) : Number(availableMinutes),
      plannedMinutes: scheduled.reduce((sum, task) => sum + taskMinutes(task), 0),
      fixedMinutes,
      projects: new Set(scheduled.map((task) => normalized(task.project)).filter(Boolean)),
      highEnergyCount: scheduled.filter((task) => energyLevel(task) === 3).length,
      preferences,
    };
  });
}

function bestDayForTask(task, days, minutes, dueDateIso) {
  return days
    .filter((day) => (!dueDateIso || day.iso <= dueDateIso))
    .filter((day) => isAllowedDayForTask(day.date, task, { preferences: day.preferences }))
    .filter((day) => canTaskFitInDay({
      taskMinutes: minutes,
      availableMinutes: day.availableMinutes,
      plannedMinutes: day.plannedMinutes,
      fixedMinutes: day.fixedMinutes,
    }))
    .map((day) => {
      const sameProject = task.project && day.projects.has(normalized(task.project));
      const highEnergyPenalty = energyLevel(task) === 3 ? day.highEnergyCount * 25 : 0;
      const loadRatio = day.availableMinutes > 0 ? (day.plannedMinutes + day.fixedMinutes) / day.availableMinutes : 1;
      return { day, score: (sameProject ? 20 : 0) - highEnergyPenalty - (loadRatio * 10) };
    })
    .sort((left, right) => right.score - left.score || left.day.iso.localeCompare(right.day.iso))[0]?.day || null;
}

function reserve(day, task, minutes) {
  day.plannedMinutes += minutes;
  if (task.project) day.projects.add(normalized(task.project));
  if (energyLevel(task) === 3) day.highEnergyCount += 1;
}

function scheduleByMicrotasks(task, days, dueDateIso) {
  const pending = (Array.isArray(task.microtarefas) ? task.microtarefas : [])
    .filter((microtask) => !microtask.completed)
    .map((microtask) => ({ ...microtask, estimatedMinutes: Math.max(5, Number(microtask.estimatedMinutes || 0)) }))
    .filter((microtask) => microtask.estimatedMinutes > 0);
  if (!pending.length) return null;

  const draftDays = days.map((day) => ({ ...day, projects: new Set(day.projects) }));
  const scheduled = [];
  for (const microtask of pending) {
    const day = bestDayForTask(task, draftDays, microtask.estimatedMinutes, dueDateIso);
    if (!day) return null;
    reserve(day, task, microtask.estimatedMinutes);
    scheduled.push({ ...microtask, scheduledDate: day.iso });
  }
  draftDays.forEach((draft, index) => {
    days[index].plannedMinutes = draft.plannedMinutes;
    days[index].projects = draft.projects;
    days[index].highEnergyCount = draft.highEnergyCount;
  });
  return scheduled;
}

export function schedulePendingTasks(tasks = [], options = {}) {
  const startDate = options.startDate || new Date();
  const todayIso = toIsoDate(startDate);
  const availableMinutes = options.availableMinutes ?? 120;
  const preferences = options.preferences || { workDays: [1, 2, 3, 4, 5], allowWeekendTasks: false, sundayIsRestDay: true };
  const commitments = Array.isArray(options.commitments) ? options.commitments : [];
  const horizonDays = Math.max(1, Number(options.horizonDays || 14));
  const replanOverdue = options.replanOverdue === true;
  const candidates = tasks.filter((task) => {
    if (!isPlanningCandidate(task) || isFixedTask(task) || task.manualSchedule === true) return false;
    const scheduledDate = toIsoDate(task.scheduledDate || task.dataSugeridaExecucao);
    if (!scheduledDate) return true;
    return replanOverdue && scheduledDate < todayIso && task.lastReplannedDate !== todayIso;
  }).sort(compareTasks);
  const days = buildDays({ startDate, horizonDays, availableMinutes, existingTasks: tasks, candidates, commitments, preferences });
  const updates = new Map();
  const deadlineRisks = [];

  for (const task of candidates) {
    const dueDateIso = toIsoDate(task.dueDate || task.dataLimite);
    const minutes = taskMinutes(task);
    let day = bestDayForTask(task, days, minutes, dueDateIso);
    let microtarefas = task.microtarefas;
    let planningUsesMicrotasks = false;

    if (!day) {
      const scheduledMicrotasks = scheduleByMicrotasks(task, days, dueDateIso);
      if (scheduledMicrotasks) {
        microtarefas = scheduledMicrotasks;
        day = days.find((candidate) => candidate.iso === scheduledMicrotasks[0].scheduledDate) || null;
        planningUsesMicrotasks = true;
      }
    }

    if (!day) {
      if (dueDateIso) {
        const risky = { ...task, scheduledDate: '', dataSugeridaExecucao: '', deadlineRisk: true, deadlineRiskMessage: DEADLINE_RISK_MESSAGE };
        updates.set(task.id, risky);
        deadlineRisks.push(risky);
      }
      continue;
    }

    if (!planningUsesMicrotasks) reserve(day, task, minutes);
    updates.set(task.id, {
      ...task,
      scheduledDate: day.iso,
      dataSugeridaExecucao: day.iso,
      deadlineRisk: false,
      deadlineRiskMessage: '',
      ...(replanOverdue ? { lastReplannedDate: todayIso } : {}),
      ...(planningUsesMicrotasks ? { microtarefas, planningUsesMicrotasks: true } : {}),
    });
  }

  const plannedTasks = tasks.map((task) => updates.get(task.id) || task);
  const plannedDates = new Set([...updates.values()].map((task) => task.scheduledDate).filter(Boolean));
  return {
    tasks: plannedTasks,
    updatedTasks: [...updates.values()],
    deadlineRisks,
    summary: {
      plannedCount: [...updates.values()].filter((task) => task.scheduledDate).length,
      riskCount: deadlineRisks.length,
      distributedDayCount: plannedDates.size,
    },
  };
}

export function replanOverdueScheduledTasks(tasks = [], options = {}) {
  return schedulePendingTasks(tasks, { ...options, replanOverdue: true });
}