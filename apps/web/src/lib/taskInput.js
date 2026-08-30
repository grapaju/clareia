import { toLocalIsoDate } from './localDate.js';

export const TASK_INPUT_DEFAULTS = Object.freeze({
  project: '',
  taskType: 'Pessoal',
  nextAction: '',
  timeEstimate: 30,
  energiaNecessaria: 'Média',
  importance: 'Média',
  urgency: 'Média',
  executionDifficulty: 'Direta',
  recurrenceFrequency: 'Nenhuma',
  status: 'pendente',
  microtarefas: [],
});

function periodFor(date) {
  const hour = date.getHours();
  if (hour < 12) return 'Manhã';
  if (hour < 18) return 'Tarde';
  return 'Noite';
}

export function validateTaskInput(input) {
  const errors = {};
  if (!String(input?.title || '').trim()) {
    errors.title = 'Informe o que precisa ser feito.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function normalizeTaskInput(input, options = {}) {
  const validation = validateTaskInput(input);
  if (!validation.valid) {
    const error = new Error(validation.errors.title);
    error.code = 'TASK_VALIDATION_ERROR';
    error.fields = validation.errors;
    throw error;
  }

  const now = options.now || new Date();
  const scheduledDate = input.scheduledDate || input.dataSugeridaExecucao || toLocalIsoDate(now);
  const timeEstimate = Number.parseInt(input.timeEstimate ?? input.estimatedTime, 10);

  return {
    ...TASK_INPUT_DEFAULTS,
    ...input,
    title: String(input.title).trim(),
    project: String(input.project || '').trim(),
    taskType: input.taskType || input.type || TASK_INPUT_DEFAULTS.taskType,
    nextAction: String(input.nextAction || '').trim(),
    dueDate: input.dueDate || input.dataLimite || input.deadline || '',
    dataSugeridaExecucao: scheduledDate,
    scheduledDate,
    periodoSugerido: input.periodoSugerido || input.scheduledPeriod || periodFor(now),
    scheduledPeriod: input.scheduledPeriod || input.periodoSugerido || periodFor(now),
    timeEstimate: Number.isFinite(timeEstimate) && timeEstimate > 0 ? timeEstimate : TASK_INPUT_DEFAULTS.timeEstimate,
  };
}