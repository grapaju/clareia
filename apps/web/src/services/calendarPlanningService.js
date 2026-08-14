import { listCalendarCommitments } from '@/services/calendarCommitmentService.js';
import { getCalendarPreferences, isAllowedDayForTask } from '@/services/calendarPreferencesService.js';

function toIsoDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];
}

function stripAccents(value = '') {
  return value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isBusinessTask(task = {}) {
  const text = stripAccents(`${task.title || ''} ${task.taskType || ''} ${task.project || ''}`);
  return /(reuniao|cliente|orcamento|proposta|cobranca|fatura|aprovacao|contato)/.test(text);
}

export function availableMinutesFromCheckIn(checkIn) {
  const tempo = String(checkIn?.tempo || '').trim().toLowerCase();
  if (tempo === '30 min' || tempo === '30min') return 30;
  if (tempo === '1h') return 60;
  if (tempo === '2h') return 120;
  if (tempo === '4h') return 240;
  if (tempo === 'dia inteiro') return 480;
  return 240;
}

export function classifyDayLoad(plannedMinutes, availableMinutes) {
  const ratio = availableMinutes > 0 ? plannedMinutes / availableMinutes : 0;
  if (ratio >= 1.15) return 'sobrecarregado';
  if (ratio >= 0.95) return 'cheio';
  if (ratio >= 0.6) return 'ok';
  return 'leve';
}

export function plannedMinutesForDate({ dateIso, tasks = [], followups = [], focusBlocks = [] }) {
  const taskMinutes = tasks
    .filter((task) => toIsoDate(task.scheduledDate || task.dataSugeridaExecucao) === dateIso)
    .reduce((sum, task) => sum + Number(task.timeEstimate || task.estimatedMinutes || 30), 0);

  const followupMinutes = followups
    .filter((item) => toIsoDate(item.nextFollowUpDate || item.reminderDate) === dateIso && item.status !== 'Concluido')
    .reduce((sum) => sum + 15, 0);

  const focusMinutes = focusBlocks
    .filter((session) => toIsoDate(session.startedAt) === dateIso)
    .reduce((sum, session) => sum + Number(session.durationMinutes || 0), 0);

  return taskMinutes + followupMinutes + focusMinutes;
}

function businessAwareDate(baseDate, task, preferences) {
  const candidate = new Date(baseDate);
  if (!isBusinessTask(task)) return candidate;
  while (!isAllowedDayForTask(candidate, task, { preferences })) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

export function suggestCalendarSlotForTask(task, context = {}) {
  const tasks = Array.isArray(context.tasks) ? context.tasks : [];
  const checkIn = context.checkIn || null;
  const followups = Array.isArray(context.followups) ? context.followups : [];
  const focusBlocks = Array.isArray(context.focusBlocks) ? context.focusBlocks : [];
  const commitments = Array.isArray(context.commitments) ? context.commitments : listCalendarCommitments();
  const preferences = context.preferences || getCalendarPreferences();
  const manual = context.manual === true;
  const availablePerDay = availableMinutesFromCheckIn(checkIn);
  const estimate = Number(task?.timeEstimate || task?.estimatedMinutes || 30);
  const dueDateIso = toIsoDate(task?.dueDate || task?.dataLimite);
  const startDate = context.startDate ? new Date(context.startDate) : new Date();
  const maxDaysToScan = 14;

  let suggested = null;

  for (let offset = 0; offset <= maxDaysToScan; offset += 1) {
    const day = new Date(startDate);
    day.setDate(day.getDate() + offset);
    const target = businessAwareDate(day, task, preferences);

    if (!isAllowedDayForTask(target, task, { preferences, manual })) {
      continue;
    }

    const dateIso = toIsoDate(target);

    if (dueDateIso && dateIso > dueDateIso) continue;

    const planned = plannedMinutesForDate({ dateIso, tasks, followups, focusBlocks });
    const commitmentMinutes = commitments
      .filter((item) => item.date === dateIso)
      .reduce((sum, item) => {
        if (item.estimatedMinutes) return sum + Number(item.estimatedMinutes || 0);
        if (item.startTime && item.endTime) {
          const start = new Date(`${dateIso}T${item.startTime}:00`).getTime();
          const end = new Date(`${dateIso}T${item.endTime}:00`).getTime();
          if (end > start) return sum + Math.round((end - start) / 60000);
        }
        return sum + 30;
      }, 0);

    const total = planned + commitmentMinutes + estimate;
    const hasMorningCommitment = commitments.some((item) => item.date === dateIso && item.startTime && Number(item.startTime.split(':')[0]) < 12);
    const hasAfternoonCommitment = commitments.some((item) => item.date === dateIso && item.startTime && Number(item.startTime.split(':')[0]) >= 12 && Number(item.startTime.split(':')[0]) < 18);

    let period = 'manhã';
    if (hasMorningCommitment && !hasAfternoonCommitment) period = 'tarde';
    if (hasMorningCommitment && hasAfternoonCommitment) period = 'noite';

    suggested = {
      date: dateIso,
      period,
      estimatedMinutes: estimate,
      plannedMinutesAfterFit: total,
      availableMinutes: availablePerDay,
      load: classifyDayLoad(total, availablePerDay),
      isOverloaded: total > availablePerDay
    };

    if (!suggested.isOverloaded) break;
  }

  return suggested;
}
