const WEEKDAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function cloneDate(date) {
  return new Date(date.getTime());
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toIsoDate(date) {
  return startOfDay(date).toISOString().split('T')[0];
}

function parseIsoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfDay(parsed);
}

function stripAccents(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isBusinessHours(date) {
  const hour = date.getHours();
  return !isWeekend(date) && hour >= 8 && hour < 18;
}

function nextBusinessDay(date) {
  const result = startOfDay(cloneDate(date));
  do {
    result.setDate(result.getDate() + 1);
  } while (isWeekend(result));
  return result;
}

function normalizePeriod(period) {
  const p = stripAccents(period || '');
  if (p.includes('manha')) return 'manhã';
  if (p.includes('tarde')) return 'tarde';
  if (p.includes('noite')) return 'noite';
  return 'tarde';
}

function normalizeEnergy(energy = '') {
  const raw = stripAccents(energy);
  if (raw.includes('alta')) return 'alta';
  if (raw.includes('baixa')) return 'baixa';
  return 'média';
}

function minutesFromCheckInTempo(checkInTempo = '') {
  const tempo = stripAccents(checkInTempo);
  if (tempo === '30min' || tempo === '30 min') return 30;
  if (tempo === '1h') return 60;
  if (tempo === '2h') return 120;
  if (tempo === '4h') return 240;
  if (tempo.includes('dia inteiro')) return 480;
  return 120;
}

function buildScheduledLabel(now, scheduledDate, scheduledPeriod) {
  const nowDay = startOfDay(now);
  const targetDay = startOfDay(scheduledDate);
  const diffDays = Math.round((targetDay.getTime() - nowDay.getTime()) / (1000 * 60 * 60 * 24));
  const weekday = WEEKDAY_NAMES[targetDay.getDay()];

  if (diffDays === 0) {
    if (scheduledPeriod === 'noite') return 'Hoje à noite';
    if (scheduledPeriod === 'tarde') return 'Hoje à tarde';
    return 'Hoje de manhã';
  }

  if (diffDays === 1) {
    if (scheduledPeriod === 'noite') return 'Amanhã à noite';
    if (scheduledPeriod === 'tarde') return 'Amanhã à tarde';
    return 'Amanhã de manhã';
  }

  if (diffDays > 1 && diffDays <= 3) {
    return `Em ${diffDays} dias`;
  }

  if (diffDays > 1 && diffDays <= 7) {
    if (scheduledPeriod === 'manhã') return `${capitalize(weekday)} de manhã`;
    if (scheduledPeriod === 'tarde') return `${capitalize(weekday)} à tarde`;
    if (scheduledPeriod === 'noite') return `${capitalize(weekday)} à noite`;
    return capitalize(weekday);
  }

  if (diffDays > 7 && diffDays <= 10) return 'Esta semana';

  return targetDay.toLocaleDateString('pt-BR');
}

function capitalize(text = '') {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function extractDueDateFromText(text, now = new Date()) {
  const normalized = stripAccents(text || '');
  const base = startOfDay(now);

  if (/\bhoje\b/.test(normalized)) return base;
  if (/\bamanha\b/.test(normalized)) {
    const d = cloneDate(base);
    d.setDate(d.getDate() + 1);
    return d;
  }

  const weekdayMap = {
    segunda: 1,
    terca: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sabado: 6,
    domingo: 0
  };

  for (const [name, value] of Object.entries(weekdayMap)) {
    const regex = new RegExp(`\\b${name}(?:-feira)?\\b`);
    if (regex.test(normalized)) {
      const d = cloneDate(base);
      while (d.getDay() !== value) {
        d.setDate(d.getDate() + 1);
      }
      return d;
    }
  }

  const fullDate = normalized.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (fullDate) {
    const [, dd, mm, yyyy] = fullDate;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!Number.isNaN(d.getTime())) return startOfDay(d);
  }

  const shortDate = normalized.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (shortDate) {
    const [, dd, mm] = shortDate;
    const d = new Date(base.getFullYear(), Number(mm) - 1, Number(dd));
    if (!Number.isNaN(d.getTime())) {
      if (d < base) d.setFullYear(d.getFullYear() + 1);
      return startOfDay(d);
    }
  }

  return null;
}

function inferFlags({ taskText, taskType, project }) {
  const normalizedText = stripAccents(taskText || '');
  const normalizedType = stripAccents(taskType || '');
  const normalizedProject = stripAccents(project || '');

  const hasClientProject = ['leone', 'corcril', 'expocentro', 'idtpr', 'torion'].includes(normalizedProject);
  const hasCommercialKeyword = /(falar com|conversar com|entrar em contato|ligar|enviar mensagem|cliente|torion|leone|corcril|expocentro|cobranca|fatura|reuniao)/.test(normalizedText);

  const isBusinessTask = /(cobranca|reuniao|google ads|contato comercial|atendimento|site)/.test(normalizedType) || hasCommercialKeyword;
  const isClientTask = hasClientProject || hasCommercialKeyword;
  const isBusinessHoursOnly = /(contato comercial|reuniao|cobranca|atendimento)/.test(normalizedType) || /(falar com|conversar com|entrar em contato|ligar|enviar mensagem|cliente|torion|leone|corcril|expocentro)/.test(normalizedText);

  return {
    isBusinessTask,
    isClientTask,
    isBusinessHoursOnly
  };
}

function ensureNotPastDate(scheduledDate, now, isBusinessHoursOnly) {
  const today = startOfDay(now);
  let target = startOfDay(scheduledDate);

  if (target < today) {
    target = isBusinessHoursOnly ? nextBusinessDay(today) : today;
  }

  return target;
}

function enforceBusinessDayIfNeeded(scheduledDate, shouldUseBusinessDay) {
  if (!shouldUseBusinessDay) return scheduledDate;
  if (!isWeekend(scheduledDate)) return scheduledDate;
  return nextBusinessDay(scheduledDate);
}

function clampPeriodByCurrentHour(period, nowHour) {
  if (nowHour >= 18 && period !== 'noite') return 'noite';
  if (nowHour >= 12 && period === 'manhã') return 'tarde';
  return period;
}

export function suggestTaskSchedule({
  now = new Date(),
  taskText = '',
  taskType = '',
  project = '',
  estimatedMinutes = 30,
  energyRequired = 'Média',
  checkInTempo = '2h',
  dueDate = null,
  baseDate = null,
  isFollowUp = false,
  priority = 'média'
} = {}) {
  const referenceNow = now instanceof Date ? now : new Date(now);
  const nowDay = startOfDay(referenceNow);
  const nowHour = referenceNow.getHours();
  const normalizedText = stripAccents(taskText);
  const normalizedType = stripAccents(taskType);
  const normalizedPriority = stripAccents(priority || 'media');

  const { isBusinessTask, isClientTask, isBusinessHoursOnly } = inferFlags({ taskText, taskType, project });
  const dueDateFromText = extractDueDateFromText(taskText, referenceNow);
  const explicitDueDate = parseIsoDate(dueDate) || dueDateFromText;

  let scheduledDate = parseIsoDate(baseDate) || nowDay;
  let scheduledPeriod = 'tarde';

  const communicationTask = /(contato comercial|cobranca|reuniao|atendimento)/.test(normalizedType) || /(falar com|conversar com|entrar em contato|ligar|enviar mensagem|mandar mensagem|perguntar se|ver se precisam|cliente|torion|leone|corcril|expocentro)/.test(normalizedText);
  const isCampaignFollowUp = isFollowUp || /(acompanhamento|monitor)/.test(normalizedType) || /(acompanhar|avaliar|verificar).*(campanha|ads|anuncio)/.test(normalizedText);

  if (isCampaignFollowUp) {
    const seed = parseIsoDate(baseDate) || nowDay;
    const waitDays = 3 + (seed.getDate() % 5); // 3-7 dias
    scheduledDate = cloneDate(seed);
    scheduledDate.setDate(scheduledDate.getDate() + waitDays);
    scheduledPeriod = 'tarde';
  }

  if (!isCampaignFollowUp) {
    if (communicationTask || isBusinessHoursOnly) {
      if (isWeekend(scheduledDate)) {
        scheduledDate = nextBusinessDay(scheduledDate);
      }

      const isToday = toIsoDate(scheduledDate) === toIsoDate(nowDay);
      if (isToday) {
        if (nowHour >= 18) {
          scheduledDate = nextBusinessDay(scheduledDate);
          scheduledPeriod = 'manhã';
        } else if (nowHour >= 12) {
          scheduledPeriod = 'tarde';
        } else {
          scheduledPeriod = 'manhã';
        }
      } else {
        scheduledPeriod = 'manhã';
      }
    } else {
      const energy = normalizeEnergy(energyRequired);
      const availableMinutes = minutesFromCheckInTempo(checkInTempo);
      const isHeavy = estimatedMinutes > 60 || energy === 'alta';

      if (toIsoDate(scheduledDate) === toIsoDate(nowDay)) {
        if (nowHour >= 18) {
          if (isHeavy || estimatedMinutes > availableMinutes) {
            scheduledDate = nextBusinessDay(scheduledDate);
            scheduledPeriod = 'tarde';
          } else {
            scheduledPeriod = 'noite';
          }
        } else if (nowHour >= 12) {
          scheduledPeriod = 'tarde';
        } else {
          scheduledPeriod = energy === 'alta' ? 'manhã' : 'tarde';
        }
      }

      if ((normalizedPriority === 'media' || normalizedPriority === 'baixa') && !explicitDueDate) {
        if (toIsoDate(scheduledDate) === toIsoDate(nowDay)) {
          scheduledDate = nextBusinessDay(scheduledDate);
          scheduledPeriod = 'tarde';
        }
      }
    }
  }

  scheduledDate = ensureNotPastDate(scheduledDate, referenceNow, isBusinessHoursOnly || communicationTask);
  scheduledDate = enforceBusinessDayIfNeeded(scheduledDate, communicationTask || isBusinessHoursOnly || isClientTask);

  if (explicitDueDate && scheduledDate > explicitDueDate) {
    scheduledDate = explicitDueDate;
    scheduledDate = ensureNotPastDate(scheduledDate, referenceNow, isBusinessHoursOnly || communicationTask);
    scheduledDate = enforceBusinessDayIfNeeded(scheduledDate, communicationTask || isBusinessHoursOnly || isClientTask);
  }

  scheduledPeriod = normalizePeriod(scheduledPeriod);
  if (toIsoDate(scheduledDate) === toIsoDate(nowDay)) {
    scheduledPeriod = clampPeriodByCurrentHour(scheduledPeriod, nowHour);
  }

  const scheduledLabel = buildScheduledLabel(referenceNow, scheduledDate, scheduledPeriod);

  return {
    dueDate: explicitDueDate ? toIsoDate(explicitDueDate) : null,
    scheduledDate: toIsoDate(scheduledDate),
    scheduledPeriod,
    scheduledLabel,
    isBusinessTask,
    isClientTask,
    isBusinessHoursOnly
  };
}

export function suggestExecutionDate(task, currentDate = new Date(), checkIn = null) {
  return suggestTaskSchedule({
    now: currentDate,
    taskText: task?.title || task?.content || '',
    taskType: task?.taskType || task?.type || '',
    project: task?.project || '',
    estimatedMinutes: task?.timeEstimate || task?.estimatedMinutes || 30,
    energyRequired: task?.energiaNecessaria || task?.energyRequired || 'Média',
    checkInTempo: checkIn?.tempo || '2h',
    dueDate: task?.dueDate || task?.dataLimite || null,
    baseDate: task?.scheduledDate || task?.dataSugeridaExecucao || null,
    isFollowUp: Boolean(task?.isFollowUp),
    priority: task?.priority || task?.importance || 'média'
  });
}

export function getScheduledLabelForTask(task, now = new Date()) {
  const referenceNow = now instanceof Date ? now : new Date(now);
  let scheduledDate = parseIsoDate(task?.scheduledDate || task?.dataSugeridaExecucao || task?.dueDate || task?.dataLimite);

  if (!scheduledDate) {
    return task?.scheduledLabel || 'Esta semana';
  }

  const flags = inferFlags({
    taskText: task?.title || task?.description || '',
    taskType: task?.taskType || task?.type || '',
    project: task?.project || ''
  });

  scheduledDate = ensureNotPastDate(scheduledDate, referenceNow, flags.isBusinessHoursOnly);
  scheduledDate = enforceBusinessDayIfNeeded(scheduledDate, flags.isBusinessHoursOnly || flags.isClientTask);

  const period = normalizePeriod(task?.scheduledPeriod || task?.periodoSugerido || 'tarde');
  return buildScheduledLabel(referenceNow, scheduledDate, period);
}
