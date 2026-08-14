function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function addBusinessDays(baseDate, amount) {
  const date = new Date(baseDate);
  let remaining = Number(amount || 0);
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return date;
}

function toIsoDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().split('T')[0];
}

function extractProjectFromTitle(taskTitle) {
  const value = String(taskTitle || '').trim();
  if (!value) return '';

  const match = value.match(/\b(?:para o|para a|para os|para as)\s+(.+)$/i);
  if (!match?.[1]) return '';

  return match[1]
    .replace(/[.!?]$/, '')
    .trim();
}

function buildSuggestedTitle(taskTitle) {
  const normalized = normalizeText(taskTitle);
  if (normalized.includes('orcamento') || normalized.includes('proposta')) {
    return 'Retorno sobre orçamento enviado';
  }
  if (normalized.includes('aprovacao')) {
    return 'Retorno sobre aprovação pendente';
  }
  if (normalized.includes('reuniao')) {
    return 'Retorno sobre reunião';
  }
  if (normalized.includes('documento') || normalized.includes('envio')) {
    return 'Retorno sobre documento enviado';
  }
  return `Retorno sobre: ${taskTitle || 'tarefa enviada'}`;
}

export function isFollowUpCandidateTask(task = {}) {
  const safeTask = task || {};
  const haystack = normalizeText(`${safeTask.title || ''} ${safeTask.taskType || ''} ${safeTask.nextAction || ''}`);
  const keywords = [
    'orcamento',
    'proposta',
    'envio',
    'cliente',
    'aprovacao',
    'reuniao',
    'documento enviado'
  ];

  return keywords.some((keyword) => haystack.includes(keyword));
}

export function buildFollowUpSuggestionFromTask(task = {}) {
  const safeTask = task || {};
  const today = new Date();
  const reminderDate = addBusinessDays(today, 2);
  const projectName = String(safeTask.project || '').trim() || extractProjectFromTitle(safeTask.title) || 'Pessoal';
  const suggestedTitle = buildSuggestedTitle(safeTask.title);

  const waitingFor = safeTask.title
    ? `Retorno sobre ${safeTask.title.toLowerCase()}`
    : 'Retorno sobre o envio realizado';

  return {
    title: suggestedTitle,
    project: projectName,
    contactName: projectName && projectName !== 'Pessoal' ? `Diretor do ${projectName}` : 'A definir',
    lastContactDate: toIsoDate(today),
    reminderDate: toIsoDate(reminderDate),
    nextFollowUpDate: toIsoDate(reminderDate),
    nextFollowUp: 'Perguntar se conseguiu avaliar o envio',
    waitingFor,
    observations: safeTask.title ? `Criado a partir da tarefa: ${safeTask.title}` : 'Criado a partir de tarefa'
  };
}
