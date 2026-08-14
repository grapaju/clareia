import { ensureClareiaInternalProject } from '@/services/internalProjectService.js';

function nextSaturday(baseDate = new Date()) {
  const date = new Date(baseDate);
  const day = date.getDay();
  const offset = (6 - day + 7) % 7 || 7;
  date.setDate(date.getDate() + offset);
  return date;
}

function formatDateToIso(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];
}

function getScheduledDateByReview(reviewWhen) {
  const now = new Date();
  if (reviewWhen === 'hoje') return formatDateToIso(now);
  if (reviewWhen === 'esta_semana') {
    const date = new Date(now);
    date.setDate(date.getDate() + 3);
    return formatDateToIso(date);
  }
  if (reviewWhen === 'sabado') return formatDateToIso(nextSaturday(now));
  return null;
}

function getPriorityFields(priority) {
  if (priority === 'alta') {
    return { importance: 'Alta', urgency: 'Alta' };
  }
  if (priority === 'media') {
    return { importance: 'Média', urgency: 'Baixa' };
  }
  return { importance: 'Baixa', urgency: 'Baixa' };
}

function formatPriority(priority) {
  if (priority === 'alta') return 'alta';
  if (priority === 'media') return 'média';
  return 'baixa';
}

function formatReviewWhen(reviewWhen) {
  if (reviewWhen === 'hoje') return 'hoje';
  if (reviewWhen === 'esta_semana') return 'esta semana';
  if (reviewWhen === 'sabado') return 'sábado';
  return 'algum dia';
}

export async function saveImprovementForLater({
  addTask,
  title,
  relatedScreen,
  description,
  priority,
  reviewWhen,
  includeInToday
}) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) {
    throw new Error('Informe o titulo da melhoria.');
  }

  ensureClareiaInternalProject();

  const cleanDescription = String(description || '').trim();
  const scheduleDate = getScheduledDateByReview(reviewWhen);
  const priorityFields = getPriorityFields(priority);
  const includeNow = Boolean(includeInToday);
  const suggestedPeriod = includeNow ? 'manhã' : 'tarde';
  const executionDifficulty = includeNow ? 'Direta' : 'Tem atrito';

  const fullDescription = [
    cleanDescription,
    `Tela relacionada: ${relatedScreen || 'Não informada'}`,
    `Tipo: melhoria do sistema`,
    `Prioridade declarada: ${formatPriority(priority)}`,
    `Revisar em: ${formatReviewWhen(reviewWhen)}`
  ]
    .filter(Boolean)
    .join('\n');

  const taskPayload = {
    title: `Melhoria Clareia: ${cleanTitle}`,
    project: 'Clareia',
    taskType: 'Desenvolvimento',
    status: includeNow ? 'Hoje' : 'Backlog',
    nextAction: 'Revisar escopo da melhoria e definir o menor próximo passo executável.',
    description: fullDescription,
    importance: priorityFields.importance,
    urgency: priorityFields.urgency,
    scheduledDate: includeNow ? formatDateToIso(new Date()) : scheduleDate,
    dataSugeridaExecucao: includeNow ? formatDateToIso(new Date()) : scheduleDate,
    periodoSugerido: suggestedPeriod,
    scheduledPeriod: suggestedPeriod,
    timeEstimate: includeNow ? 30 : 45,
    energiaNecessaria: includeNow ? 'Média' : 'Baixa',
    executionDifficulty
  };

  return addTask(taskPayload);
}
