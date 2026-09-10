export const PROFESSIONAL_CATEGORIES = [
  'Desenvolvimento',
  'Correção / manutenção',
  'Testes',
  'Reunião',
  'Análise / planejamento',
  'Suporte',
  'Administrativo',
  'Outro',
];

const MAX_PLAUSIBLE_JOURNEY_MINUTES = 16 * 60;

function emptyJourneyMetrics() {
  return { grossMinutes: 0, pauseMinutes: 0, netMinutes: 0 };
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function zonedParts(value, timeZone) {
  const date = validDate(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function getZonedDateKey(value, timeZone) {
  const parts = zonedParts(value, timeZone);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
}

export function getProfessionalWeekRange(referenceDate = new Date(), timeZone = 'UTC') {
  const parts = zonedParts(referenceDate, timeZone);
  if (!parts) return { startDate: '', endDate: '' };
  const localNoon = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 12));
  const weekday = localNoon.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = new Date(localNoon);
  start.setUTCDate(start.getUTCDate() + mondayOffset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function inferProfessionalCategory(title) {
  const value = String(title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(reuniao|alinhamento|call|meet)\b/.test(value)) return 'Reunião';
  if (/\b(teste|testar|validar|homolog)\w*/.test(value)) return 'Testes';
  if (/\b(corrigir|correcao|ajustar|manutencao|bug|erro)\w*/.test(value)) return 'Correção / manutenção';
  if (/\b(criar|desenvolver|implementar|programar|modulo|codigo)\w*/.test(value)) return 'Desenvolvimento';
  if (/\b(analisar|planejar|revisar|levantamento|documentacao)\w*/.test(value)) return 'Análise / planejamento';
  if (/\b(suporte|atender|chamado|usuario)\w*/.test(value)) return 'Suporte';
  if (/\b(administrativo|fatura|nota fiscal|relatorio|organizar)\w*/.test(value)) return 'Administrativo';
  return 'Outro';
}

export function intervalMinutes(startedAt, endedAt) {
  const start = validDate(startedAt)?.getTime();
  const end = validDate(endedAt)?.getTime();
  if (!start || !end || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

function zonedDateTimeParts(value, timeZone) {
  const date = validDate(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone || 'UTC',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function zonedMidnight(dateKey, timeZone) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const desiredLocalTime = Date.UTC(year, month - 1, day);
  let instant = desiredLocalTime;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = zonedDateTimeParts(instant, timeZone);
    if (!parts) return null;
    const representedLocalTime = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    instant += desiredLocalTime - representedLocalTime;
  }
  return new Date(instant);
}

function nextDateKey(dateKey) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function boundedIntervalMinutes(startedAt, endedAt, boundaryStart, boundaryEnd) {
  const start = Math.max(validDate(startedAt)?.getTime() || 0, validDate(boundaryStart)?.getTime() || 0);
  const end = Math.min(validDate(endedAt)?.getTime() || 0, validDate(boundaryEnd)?.getTime() || 0);
  if (!start || !end || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

export function getDailyTargetMinutes({ weeklyTargetMinutes = 2400, workDays = [1, 2, 3, 4, 5] } = {}) {
  const normalizedWorkDays = [...new Set((Array.isArray(workDays) ? workDays : [])
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  const workDayCount = normalizedWorkDays.length || 5;
  return Math.max(0, Math.round(Number(weeklyTargetMinutes || 0) / workDayCount));
}

export function getJourneyDisplayState({ currentJourney = null, journeys = [], projectName = '', now = new Date(), timeZone = 'UTC' } = {}) {
  if (currentJourney?.status === 'active') return { kind: 'active', journey: currentJourney };
  if (currentJourney?.status === 'paused') return { kind: 'paused', journey: currentJourney };

  const normalizedProject = String(projectName || '').trim().toLocaleLowerCase('pt-BR');
  const closedToday = [...journeys]
    .filter((journey) => {
      const journeyProject = String(journey?.projectName || '').trim().toLocaleLowerCase('pt-BR');
      const journeyTimeZone = journey?.timezone || timeZone;
      return journey?.status === 'closed'
        && Boolean(journey?.endedAt)
        && (!normalizedProject || journeyProject === normalizedProject)
        && getZonedDateKey(journey.endedAt, journeyTimeZone) === getZonedDateKey(now, journeyTimeZone);
    })
    .sort((left, right) => new Date(right.endedAt) - new Date(left.endedAt))[0] || null;

  return closedToday
    ? { kind: 'closed', journey: closedToday }
    : { kind: 'not_started', journey: null };
}

export function calculateJourneyMetrics({ journey, pauses = [], now = new Date() }) {
  if (!journey?.startedAt) return emptyJourneyMetrics();
  const effectiveEnd = journey.endedAt || now;
  const grossMinutes = intervalMinutes(journey.startedAt, effectiveEnd);
  const pauseMinutes = pauses.reduce((total, pause) => total + intervalMinutes(pause.startedAt, pause.endedAt || effectiveEnd), 0);
  const netMinutes = Math.max(0, grossMinutes - pauseMinutes);
  return {
    grossMinutes,
    pauseMinutes,
    netMinutes,
  };
}

export function calculateDailyJourneyMetrics({ journey, pauses = [], now = new Date(), timeZone = '' }) {
  if (!journey?.startedAt) return emptyJourneyMetrics();
  const effectiveTimeZone = timeZone || journey.timezone || 'UTC';
  const dateKey = getZonedDateKey(now, effectiveTimeZone);
  const dayStart = zonedMidnight(dateKey, effectiveTimeZone);
  const dayEnd = zonedMidnight(nextDateKey(dateKey), effectiveTimeZone);
  const effectiveEnd = journey.endedAt || now;
  if (!dayStart || !dayEnd) return calculateJourneyMetrics({ journey, pauses, now });

  const grossMinutes = boundedIntervalMinutes(journey.startedAt, effectiveEnd, dayStart, dayEnd);
  const pauseMinutes = pauses.reduce((total, pause) => total + boundedIntervalMinutes(
    pause.startedAt,
    pause.endedAt || effectiveEnd,
    new Date(Math.max(dayStart.getTime(), validDate(journey.startedAt)?.getTime() || 0)),
    new Date(Math.min(dayEnd.getTime(), validDate(effectiveEnd)?.getTime() || 0))
  ), 0);
  const netMinutes = Math.max(0, grossMinutes - pauseMinutes);
  return {
    grossMinutes,
    pauseMinutes,
    netMinutes,
  };
}

export function isAnomalousJourney(journey, now = new Date(), timeZone = '') {
  if (!journey?.startedAt) return false;
  const effectiveEnd = journey.endedAt || now;
  const grossMinutes = intervalMinutes(journey.startedAt, effectiveEnd);
  if (grossMinutes > MAX_PLAUSIBLE_JOURNEY_MINUTES) return true;
  if (journey.endedAt) return false;
  const effectiveTimeZone = timeZone || journey.timezone || 'UTC';
  return getZonedDateKey(journey.startedAt, effectiveTimeZone) !== getZonedDateKey(now, effectiveTimeZone);
}

export function getValidJourneyMetrics({ journey, pauses = [], now = new Date(), timeZone = '' } = {}) {
  if (!journey?.startedAt) return { ...emptyJourneyMetrics(), validMinutes: 0, rawMinutes: 0, isAnomalous: false };
  const rawMetrics = calculateJourneyMetrics({ journey, pauses, now });
  const dailyMetrics = calculateDailyJourneyMetrics({ journey, pauses, now, timeZone });
  const isAnomalous = isAnomalousJourney(journey, now, timeZone);
  return {
    ...dailyMetrics,
    validMinutes: isAnomalous ? 0 : dailyMetrics.netMinutes,
    rawMinutes: rawMetrics.netMinutes,
    isAnomalous,
  };
}

export function calculateWeeklyProgress({ journeys = [], pauses = [], weeklyTargetMinutes = 2400, now = new Date(), timeZone = 'UTC' }) {
  const range = getProfessionalWeekRange(now, timeZone);
  const weekStart = zonedMidnight(range.startDate, timeZone);
  const weekEnd = zonedMidnight(nextDateKey(range.endDate), timeZone);
  const weeklyMetrics = journeys.reduce((totals, journey) => {
    if (!journey?.startedAt || !weekStart || !weekEnd || isAnomalousJourney(journey, now, timeZone)) return totals;
    const effectiveEnd = journey.endedAt || now;
    const grossMinutes = boundedIntervalMinutes(journey.startedAt, effectiveEnd, weekStart, weekEnd);
    if (!grossMinutes) return totals;
    const journeyPauses = pauses.filter((pause) => pause.journeyId === journey.id);
    const pauseMinutes = journeyPauses.reduce((sum, pause) => sum + boundedIntervalMinutes(
      pause.startedAt,
      pause.endedAt || effectiveEnd,
      weekStart,
      weekEnd
    ), 0);
    return {
      totalMinutes: totals.totalMinutes + Math.max(0, grossMinutes - pauseMinutes),
      pauseMinutes: totals.pauseMinutes + pauseMinutes,
    };
  }, { totalMinutes: 0, pauseMinutes: 0 });
  const target = Math.max(0, Number(weeklyTargetMinutes || 0));
  return {
    ...range,
    totalMinutes: weeklyMetrics.totalMinutes,
    pauseMinutes: weeklyMetrics.pauseMinutes,
    targetMinutes: target,
    balanceMinutes: weeklyMetrics.totalMinutes - target,
    remainingMinutes: Math.max(0, target - weeklyMetrics.totalMinutes),
    aboveTargetMinutes: Math.max(0, weeklyMetrics.totalMinutes - target),
  };
}

export function buildWorkdayReport({ journeys = [], pauses = [], weeklyTargetMinutes = 0, now = new Date(), timeZone = 'UTC' }) {
  const dailyTotals = new Map();
  const validJourneys = journeys.filter((journey) => !isAnomalousJourney(journey, now, journey.timezone || timeZone));

  validJourneys.forEach((journey) => {
    const journeyTimeZone = journey.timezone || timeZone;
    const effectiveEnd = journey.endedAt || now;
    let dateKey = getZonedDateKey(journey.startedAt, journeyTimeZone);
    const finalDateKey = getZonedDateKey(effectiveEnd, journeyTimeZone);
    const journeyPauses = pauses.filter((pause) => pause.journeyId === journey.id);

    while (dateKey && dateKey <= finalDateKey) {
      const dayStart = zonedMidnight(dateKey, journeyTimeZone);
      const dayEnd = zonedMidnight(nextDateKey(dateKey), journeyTimeZone);
      const grossMinutes = boundedIntervalMinutes(journey.startedAt, effectiveEnd, dayStart, dayEnd);
      const pauseMinutes = journeyPauses.reduce((total, pause) => total + boundedIntervalMinutes(
        pause.startedAt,
        pause.endedAt || effectiveEnd,
        dayStart,
        dayEnd
      ), 0);
      if (grossMinutes > 0) {
        const current = dailyTotals.get(dateKey) || { date: dateKey, workdayDuration: 0, pauseDuration: 0, closedWorkdays: 0 };
        current.workdayDuration += Math.max(0, grossMinutes - pauseMinutes);
        current.pauseDuration += pauseMinutes;
        if (journey.status === 'closed' && getZonedDateKey(journey.endedAt, journeyTimeZone) === dateKey) current.closedWorkdays += 1;
        dailyTotals.set(dateKey, current);
      }
      dateKey = nextDateKey(dateKey);
    }
  });

  const dailyRows = [...dailyTotals.values()].sort((left, right) => right.date.localeCompare(left.date));
  return {
    weekly: calculateWeeklyProgress({ journeys, pauses, weeklyTargetMinutes, now, timeZone }),
    workdayDuration: dailyRows.reduce((total, row) => total + row.workdayDuration, 0),
    pauseDuration: dailyRows.reduce((total, row) => total + row.pauseDuration, 0),
    closedWorkdays: validJourneys.filter((journey) => journey.status === 'closed').length,
    dailyRows,
  };
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function professionalActivitiesToCsv(activities = [], timeZone = 'UTC') {
  const header = ['Data', 'Projeto', 'Tarefa/atividade', 'Categoria', 'Início', 'Fim', 'Duração (min)', 'Origem', 'Manual', 'Observação'];
  const rows = activities.map((activity) => [
    getZonedDateKey(activity.startedAt, timeZone),
    activity.projectName || '',
    activity.title || '',
    activity.category || 'Outro',
    activity.startedAt || '',
    activity.endedAt || '',
    Number(activity.durationMinutes || 0),
    activity.source || '',
    activity.source === 'manual' ? 'sim' : 'não',
    activity.notes || '',
  ].map(csvCell).join(';'));
  return [header.join(';'), ...rows].join('\n');
}

export function isForgottenJourney(journey, now = new Date(), thresholdMinutes = 960) {
  if (!journey?.startedAt || journey.endedAt) return false;
  return intervalMinutes(journey.startedAt, now) >= thresholdMinutes;
}

export function calculateWeeklySummaryProgress({ journeys = [], weeklyTargetMinutes = 2400, now = new Date(), timeZone = 'UTC' }) {
  const range = getProfessionalWeekRange(now, timeZone);
  const totalMinutes = journeys.reduce((total, journey) => {
    const key = getZonedDateKey(journey.startedAt, timeZone);
    return key >= range.startDate && key <= range.endDate ? total + Number(journey.netMinutes || 0) : total;
  }, 0);
  const targetMinutes = Math.max(0, Number(weeklyTargetMinutes || 0));
  return {
    ...range,
    totalMinutes,
    targetMinutes,
    remainingMinutes: Math.max(0, targetMinutes - totalMinutes),
    aboveTargetMinutes: Math.max(0, totalMinutes - targetMinutes),
  };
}