import { endOfWeek, format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { normalizeTaskStatus, TASK_STATUS } from './taskExecution.js';

function weekBounds(baseDate) {
  const options = { weekStartsOn: 1 };
  return {
    start: startOfWeek(baseDate, options),
    end: endOfWeek(baseDate, options),
  };
}

function dateLabel(date, pattern) {
  return format(date, pattern, { locale: ptBR });
}

function shortMonth(date) {
  return `${dateLabel(date, 'MMM').replace(/\.$/, '')}.`;
}

export function formatWeekRangeLong(baseDate) {
  const { start, end } = weekBounds(baseDate);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth) return `${dateLabel(start, 'd')} a ${dateLabel(end, "d 'de' MMMM 'de' yyyy")}`;
  if (sameYear) return `${dateLabel(start, "d 'de' MMMM")} a ${dateLabel(end, "d 'de' MMMM 'de' yyyy")}`;
  return `${dateLabel(start, "d 'de' MMMM 'de' yyyy")} a ${dateLabel(end, "d 'de' MMMM 'de' yyyy")}`;
}

export function formatWeekRangeShort(baseDate) {
  const { start, end } = weekBounds(baseDate);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth) return `${dateLabel(start, 'd')}–${dateLabel(end, 'd')} ${shortMonth(end)} ${dateLabel(end, 'yyyy')}`;
  if (sameYear) return `${dateLabel(start, 'd')} ${shortMonth(start)} – ${dateLabel(end, 'd')} ${shortMonth(end)} ${dateLabel(end, 'yyyy')}`;
  return `${dateLabel(start, 'd')} ${shortMonth(start)} ${dateLabel(start, 'yyyy')} – ${dateLabel(end, 'd')} ${shortMonth(end)} ${dateLabel(end, 'yyyy')}`;
}

export function getCalendarTaskActions(status) {
  const normalized = normalizeTaskStatus(status);
  if (normalized === TASK_STATUS.CONCLUIDA) {
    return { primaryActionLabel: '', showComplete: false, showReopen: true };
  }

  const primaryActionLabel = normalized === TASK_STATUS.PAUSADA
    ? 'Retomar'
    : normalized === TASK_STATUS.EM_ANDAMENTO
      ? 'Continuar'
      : 'Começar';

  return { primaryActionLabel, showComplete: true, showReopen: false };
}