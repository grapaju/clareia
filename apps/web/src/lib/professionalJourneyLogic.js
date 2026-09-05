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

export function calculateJourneyMetrics({ journey, pauses = [], activities = [], now = new Date() }) {
  if (!journey?.startedAt) return { grossMinutes: 0, pauseMinutes: 0, netMinutes: 0, activityMinutes: 0, unclassifiedMinutes: 0 };
  const effectiveEnd = journey.endedAt || now;
  const grossMinutes = intervalMinutes(journey.startedAt, effectiveEnd);
  const pauseMinutes = pauses.reduce((total, pause) => total + intervalMinutes(pause.startedAt, pause.endedAt || effectiveEnd), 0);
  const activityMinutes = activities.reduce((total, activity) => {
    const minutes = Number(activity.durationMinutes || 0) || intervalMinutes(activity.startedAt, activity.endedAt || effectiveEnd);
    return total + Math.max(0, minutes);
  }, 0);
  const netMinutes = Math.max(0, grossMinutes - pauseMinutes);
  return {
    grossMinutes,
    pauseMinutes,
    netMinutes,
    activityMinutes,
    unclassifiedMinutes: Math.max(0, netMinutes - activityMinutes),
  };
}

export function calculateWeeklyProgress({ journeys = [], pauses = [], activities = [], weeklyTargetMinutes = 2400, now = new Date(), timeZone = 'UTC' }) {
  const range = getProfessionalWeekRange(now, timeZone);
  const weeklyJourneys = journeys.filter((journey) => {
    const key = getZonedDateKey(journey.startedAt, timeZone);
    return key >= range.startDate && key <= range.endDate;
  });
  const totalMinutes = weeklyJourneys.reduce((total, journey) => {
    const journeyPauses = pauses.filter((pause) => pause.journeyId === journey.id);
    const journeyActivities = activities.filter((activity) => activity.journeyId === journey.id);
    return total + calculateJourneyMetrics({ journey, pauses: journeyPauses, activities: journeyActivities, now }).netMinutes;
  }, 0);
  const target = Math.max(0, Number(weeklyTargetMinutes || 0));
  return {
    ...range,
    totalMinutes,
    targetMinutes: target,
    remainingMinutes: Math.max(0, target - totalMinutes),
    aboveTargetMinutes: Math.max(0, totalMinutes - target),
  };
}

export function buildProfessionalReport({ activities = [], journeys = [], pauses = [], weeklyTargetMinutes = 0, now = new Date(), timeZone = 'UTC' }) {
  const categoryMinutes = activities.reduce((totals, activity) => {
    const category = PROFESSIONAL_CATEGORIES.includes(activity.category) ? activity.category : 'Outro';
    totals[category] = (totals[category] || 0) + Number(activity.durationMinutes || 0);
    return totals;
  }, {});
  const principalActivities = [...new Set(activities.map((activity) => String(activity.title || '').trim()).filter(Boolean))];
  return {
    weekly: calculateWeeklyProgress({ journeys, pauses, activities, weeklyTargetMinutes, now, timeZone }),
    categoryMinutes,
    principalActivities,
    activities,
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