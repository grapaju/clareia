import { z } from 'zod';
import { toLocalIsoDate } from './localDate.js';

export const MIND_DUMP_TEMPLATE = `Data:
Horário:
Tarefa:
Projeto:
Tempo estimado:
Descrição/notas:
Microtarefas:
Prazo:
Lembrete:
Recorrência:
Não alterar / observações:`;

export const MIND_DUMP_LABELS = {
  title: ['tarefa'],
  project: ['projeto'],
  date: ['data'],
  time: ['horário', 'horario'],
  duration: ['tempo', 'tempo estimado', 'duração', 'duracao', 'estimativa'],
  notes: ['descrição', 'descricao', 'descrição/notas', 'descricao/notas', 'notas', 'contexto', 'observações', 'observacoes'],
  microtasks: ['microtarefas', 'microtarefas esperadas', 'passos', 'etapas', 'checklist'],
  constraints: ['não alterar', 'nao alterar', 'manter', 'não mexer', 'nao mexer', 'observações importantes', 'observacoes importantes', 'restrições', 'restricoes', 'não alterar / observações', 'nao alterar / observacoes'],
  deadline: ['prazo', 'data limite', 'data-limite'],
  reminder: ['lembrete'],
  recurrence: ['recorrência', 'recorrencia'],
  priority: ['prioridade'],
  energy: ['energia'],
};

const WarningSchema = z.object({
  code: z.string(),
  message: z.string(),
});

const MicrotaskSchema = z.object({
  text: z.string().min(1),
  source: z.enum(['explicit', 'suggested']),
});

const DateTimeSchema = z.object({
  date: z.string(),
  time: z.string().optional(),
});

export const ParsedTaskSchema = z.object({
  title: z.string().min(1),
  project: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    status: z.enum(['existing', 'ambiguous', 'undecided', 'none']).optional(),
  }).optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  durationSource: z.enum(['explicit', 'suggested']).optional(),
  deadline: DateTimeSchema.optional(),
  reminder: DateTimeSchema.optional(),
  recurrence: z.object({ raw: z.string(), frequency: z.string() }).optional(),
  notes: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  microtasks: z.array(MicrotaskSchema).optional(),
  priority: z.string().optional(),
  energy: z.string().optional(),
  dateSource: z.enum(['explicit', 'inferred']).optional(),
  timeSource: z.enum(['explicit', 'inferred']).optional(),
});

export const ParsedMindDumpSchema = z.object({
  rawText: z.string().min(1),
  tasks: z.array(ParsedTaskSchema),
  warnings: z.array(WarningSchema).optional(),
});

function normalize(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const LABEL_LOOKUP = Object.entries(MIND_DUMP_LABELS).flatMap(([field, labels]) => (
  labels.map((label) => ({ field, normalized: normalize(label) }))
));

function getLabel(line) {
  const match = String(line).match(/^\s*([^:]{2,40})\s*:\s*(.*)$/);
  if (!match) return null;
  const label = LABEL_LOOKUP.find((item) => item.normalized === normalize(match[1]));
  return label ? { field: label.field, value: match[2].trim() } : null;
}

function extractStructuredFields(rawText) {
  const fields = {};
  let currentField = null;
  String(rawText).replace(/\r/g, '').split('\n').forEach((line) => {
    const label = getLabel(line);
    if (label) {
      currentField = label.field;
      fields[currentField] = [fields[currentField], label.value].filter(Boolean).join('\n');
      return;
    }
    if (currentField && line.trim()) fields[currentField] = [fields[currentField], line.trim()].filter(Boolean).join('\n');
    else if (!line.trim()) currentField = null;
  });
  return fields;
}

function durationMinutes(value) {
  const text = normalize(value);
  const hoursAndMinutes = text.match(/\b(\d+)\s*h(?:oras?)?\s*(\d{1,2})\b/);
  if (hoursAndMinutes) return Number(hoursAndMinutes[1]) * 60 + Number(hoursAndMinutes[2]);
  if (/\bmeia hora\b/.test(text)) return 30;
  const minutes = text.match(/\b(\d+)\s*(?:min|minuto|minutos)\b/);
  if (minutes) return Number(minutes[1]);
  const hours = text.match(/\b(\d+(?:[.,]\d+)?)\s*h(?:oras?)?\b/);
  return hours ? Math.round(Number(hours[1].replace(',', '.')) * 60) : undefined;
}

function explicitTime(value) {
  const text = String(value || '');
  const match = text.match(/(?:\b(?:às|as)\s*)?\b([01]?\d|2[0-3])(?:[:h]([0-5]\d))?h?\b/i);
  if (!match) return undefined;
  if (!/(?:\b(?:às|as)\s+|\d{1,2}:\d{2}|\d{1,2}h(?:\d{2})?\b)/i.test(match[0])) return undefined;
  return `${String(Number(match[1])).padStart(2, '0')}:${match[2] || '00'}`;
}

function addDays(date, amount) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

const WEEKDAYS = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

function resolveDate(value, now) {
  const text = normalize(value);
  if (!text) return undefined;
  const numeric = String(value).match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]);
    let year = numeric[3] ? Number(numeric[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    let result = new Date(year, month - 1, day);
    if (!numeric[3] && result < new Date(now.getFullYear(), now.getMonth(), now.getDate())) result = new Date(year + 1, month - 1, day);
    if (result.getDate() !== day || result.getMonth() !== month - 1) return undefined;
    return toLocalIsoDate(result);
  }
  if (/\bdepois de amanha\b/.test(text)) return toLocalIsoDate(addDays(now, 2));
  if (/\bamanha\b/.test(text)) return toLocalIsoDate(addDays(now, 1));
  if (/\bhoje\b/.test(text)) return toLocalIsoDate(now);
  const weekdayIndex = WEEKDAYS.findIndex((weekday) => new RegExp(`\\b${weekday}\\b`).test(text));
  if (weekdayIndex >= 0) {
    let offset = (weekdayIndex - now.getDay() + 7) % 7;
    if (offset === 0 || /proxim/.test(text)) offset += 7;
    return toLocalIsoDate(addDays(now, offset));
  }
  return undefined;
}

function splitItems(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .split(/\n|;|(?<=[.!?])\s+/)
    .map((item) => item.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim().replace(/[.;]+$/, ''))
    .filter(Boolean);
}

function extractConstraints(value) {
  const constraints = [];
  const text = String(value || '');
  const negative = text.match(/(?:não|nao)\s+(?:alterar|mexer(?:\s+em|\s+no|\s+na)?)\s+([^.;]+)/gi) || [];
  negative.forEach((entry) => {
    const objects = entry.replace(/^(?:não|nao)\s+(?:alterar|mexer(?:\s+em|\s+no|\s+na)?)\s+/i, '').split(/\s+(?:nem|ou)\s+|,/i);
    objects.map((item) => item.trim()).filter(Boolean).forEach((item) => constraints.push(`Não alterar ${item}`));
  });
  const maintain = text.match(/manter\s+[^.;]+/gi) || [];
  maintain.forEach((entry) => constraints.push(entry.trim().replace(/^./, (char) => char.toUpperCase())));
  const unchanged = text.match(/([^.;]+?)\s+permanec(?:e|em)\s+sem\s+altera[çc][aã]o/gi) || [];
  unchanged.forEach((entry) => {
    const objects = entry.replace(/\s+permanec(?:e|em)\s+sem\s+altera[çc][aã]o$/i, '').split(/\s+e\s+|,/i);
    objects.map((item) => item.trim()).filter(Boolean).forEach((item) => constraints.push(`Não alterar ${item}`));
  });
  return [...new Set(constraints)];
}

function recurrence(value) {
  const text = String(value || '');
  const normalized = normalize(text);
  if (/\btod[ao]s? os dias uteis\b/.test(normalized)) return { raw: text.trim(), frequency: 'Dias úteis' };
  if (/\btod[ao]\s+(segunda|terca|quarta|quinta|sexta|sabado|domingo)\b/.test(normalized)) return { raw: text.trim(), frequency: 'Semanal' };
  if (/\btodo dia \d{1,2}\b|\bmensalmente\b/.test(normalized)) return { raw: text.trim(), frequency: 'Mensal' };
  if (/\ba cada 15 dias\b/.test(normalized)) return { raw: text.trim(), frequency: 'Quinzenal' };
  if (/\btodo dia\b|\bdiariamente\b/.test(normalized)) return { raw: text.trim(), frequency: 'Diária' };
  return undefined;
}

function projectCandidates(context = {}) {
  const aliases = Array.isArray(context.aliases) ? context.aliases : [];
  return (context.projects || []).map((project) => {
    const projectAliases = aliases
      .filter((alias) => alias.projectId === project.id || normalize(alias.projectName) === normalize(project.name))
      .map((alias) => alias.alias || alias.name)
      .filter(Boolean);
    return { ...project, signatures: [project.name, ...(project.aliases || []), ...projectAliases].map(normalize).filter(Boolean) };
  });
}

function resolveProject(explicitName, text, context = {}) {
  const candidates = projectCandidates(context);
  const query = normalize(explicitName);
  if (query) {
    const exact = candidates.filter((project) => project.signatures.includes(query));
    if (exact.length === 1) return { id: String(exact[0].id || ''), name: exact[0].name, confidence: 1, status: 'existing' };
    if (exact.length > 1) return { name: explicitName.trim(), confidence: 0, status: 'ambiguous' };
    return { name: explicitName.trim(), confidence: 0.65, status: 'undecided' };
  }
  const haystack = normalize(text);
  const matches = candidates.filter((project) => project.signatures.some((signature) => new RegExp(`(?:^| )${escapeRegExp(signature)}(?: |$)`).test(haystack)));
  if (matches.length === 1) return { id: String(matches[0].id || ''), name: matches[0].name, confidence: 0.95, status: 'existing' };
  if (matches.length > 1) return { confidence: 0, status: 'ambiguous' };
  return undefined;
}

function inferProjectName(text) {
  const match = String(text).match(/\b(?:campanha|site|relat[oó]rio|orçamento|fatura)\s+(?:da|do)\s+([\p{L}0-9][\p{L}0-9_-]*)/iu);
  return match?.[1];
}

function cleanTitle(value) {
  return String(value || '')
    .replace(/^\s*(?:hoje|amanh[ãa]|depois de amanh[ãa]|(?:próxima\s+)?(?:segunda|terça|quarta|quinta|sexta|sábado|domingo))\s*[-—:,]?\s*/i, '')
    .replace(/\b(?:por|durante)\s+(?:uns?\s+|cerca de\s+|mais ou menos\s+)?(?:\d+\s*(?:min(?:utos?)?|h(?:oras?)?(?:\s*\d{1,2})?)|meia hora)\b/gi, '')
    .replace(/\s+(?:às|as)\s+\d{1,2}(?::\d{2}|h\d{0,2})?/gi, '')
    .replace(/[.,;:]+$/, '').replace(/\s+/g, ' ').trim()
    .replace(/^(?:preciso|quero|tenho que|vou)\s+/i, '')
    .replace(/^./, (char) => char.toUpperCase());
}

const ACTION = '(?:ver|revisar|registrar|atualizar|corrigir|publicar|ligar|cobrar|enviar|entregar|responder|verificar|acompanhar|preparar|agendar|criar|fazer|estudar|comprar|organizar|analisar)';

function splitNaturalTasks(text) {
  const compact = String(text).replace(/\r/g, '').replace(/\n\s*[-*•]\s*/g, ', ').replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  const parts = compact.split(new RegExp(`(?:,|\\s+e|\\s+depois)\\s+(?=(?:(?:hoje|amanh[ãa]|(?:próxima\\s+)?(?:segunda|terça|quarta|quinta|sexta|sábado|domingo))\\s+)?${ACTION}\\b)`, 'gi'));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function naturalNotes(rawText, titleSource) {
  const sentences = splitItems(rawText);
  const notes = sentences.filter((sentence) => sentence !== titleSource && !new RegExp(`^${ACTION}\\b`, 'i').test(normalize(sentence)) && !/^(?:hoje|amanha|depois de amanha)\b/.test(normalize(sentence)));
  return notes.join('\n') || undefined;
}

function parseReminder(value, now) {
  const match = String(value || '').match(/(?:me\s+lembr(?:ar|a)|lembrete\s*:?)\s+(.+?)(?:\s+(?:de|para)\s+[^.]+)?$/i);
  if (!match) return undefined;
  const date = resolveDate(match[1], now);
  if (!date) return undefined;
  return { date, ...(explicitTime(match[1]) ? { time: explicitTime(match[1]) } : {}) };
}

function parseDeadline(value, now) {
  const match = String(value || '').match(/(?:\baté|\bate|prazo\s*:)\s*([^,.;]+)/i);
  if (!match) return undefined;
  const date = resolveDate(match[1], now);
  if (!date) return undefined;
  return { date, ...(explicitTime(match[1]) ? { time: explicitTime(match[1]) } : {}) };
}

function structuredTask(fields, rawText, context, now, warnings) {
  if (!fields.title) return null;
  let title = cleanTitle(fields.title);
  const explicitProject = fields.project || title.match(/^([^—-]{2,50})\s+[—-]\s+(.+)$/)?.[1];
  if (!fields.project && explicitProject) title = title.replace(/^([^—-]{2,50})\s+[—-]\s+/, '');
  const date = resolveDate(fields.date || rawText.match(/^\s*(?:hoje|amanh[ãa])?\s*[—-]?\s*\d{1,2}[/-]\d{1,2}/im)?.[0], now);
  const headingWord = rawText.match(/^\s*(hoje|amanh[ãa])\s*[—-]\s*(\d{1,2}[/-]\d{1,2})/im);
  if (headingWord && resolveDate(headingWord[1], now) !== resolveDate(headingWord[2], now)) {
    warnings.push({ code: 'conflicting_dates', message: 'Encontrei referências de data diferentes.' });
  }
  const constraints = extractConstraints([fields.constraints, fields.notes].filter(Boolean).join('. '));
  const microtasks = splitItems(fields.microtasks).map((text) => ({ text, source: 'explicit' }));
  return {
    title,
    ...(resolveProject(explicitProject, rawText, context) ? { project: resolveProject(explicitProject, rawText, context) } : {}),
    ...(date ? { date, dateSource: 'explicit' } : {}),
    ...(explicitTime(fields.time) ? { time: explicitTime(fields.time), timeSource: 'explicit' } : {}),
    ...(durationMinutes(fields.duration) ? { durationMinutes: durationMinutes(fields.duration), durationSource: 'explicit' } : {}),
    ...(parseDeadline(fields.deadline || rawText, now) ? { deadline: parseDeadline(fields.deadline || rawText, now) } : {}),
    ...(parseReminder(fields.reminder || rawText, now) ? { reminder: parseReminder(fields.reminder || rawText, now) } : {}),
    ...(recurrence(fields.recurrence || rawText) ? { recurrence: recurrence(fields.recurrence || rawText) } : {}),
    ...(fields.notes ? { notes: fields.notes } : {}),
    ...(constraints.length ? { constraints } : {}),
    ...(microtasks.length ? { microtasks } : {}),
    ...(fields.priority ? { priority: fields.priority } : {}),
    ...(fields.energy ? { energy: fields.energy } : {}),
  };
}

function naturalTasks(rawText, context, now) {
  const reminder = parseReminder(rawText, now);
  const recurrenceValue = recurrence(rawText);
  const constraints = extractConstraints(rawText);
  const headingDate = resolveDate(String(rawText).replace(/\r/g, '').split('\n')[0], now);
  const chunks = splitNaturalTasks(rawText).filter((chunk) => new RegExp(`\\b${ACTION}\\b`, 'i').test(normalize(chunk)));
  return chunks.map((chunk, index) => {
    const actionMatch = chunk.match(new RegExp(`\\b(${ACTION.slice(3, -1)})\\b`, 'i'));
    const taskSource = actionMatch ? chunk.slice(actionMatch.index) : chunk;
    const firstSentence = splitItems(taskSource)[0] || taskSource;
    const title = cleanTitle(firstSentence.replace(/\b(?:até|ate)\s+.+$/i, ''));
    const date = resolveDate(chunk, now) || headingDate || (index > 0 ? resolveDate(rawText.slice(0, rawText.indexOf(chunk)), now) : undefined);
    const projectName = inferProjectName(chunk);
    const project = resolveProject(projectName, chunk, context) || (projectName ? { name: projectName, confidence: 0.6, status: 'undecided' } : undefined);
    const gerundStart = chunk.search(/\b(?:revisando|corrigindo|publicando|registrando|anotando|salvando|preparando)\b/i);
    const gerunds = gerundStart < 0 ? [] : chunk.slice(gerundStart)
      .split(/,|\s+e\s+/i)
      .map((item) => item.trim().match(/^(revisando|corrigindo|publicando|registrando|anotando|salvando|preparando)\s+(.+)$/i))
      .filter(Boolean)
      .map((match) => `${match[1].replace(/ndo$/i, 'r')} ${match[2].replace(/[.;]+$/, '')}`);
    return {
      title,
      ...(project ? { project } : {}),
      ...(date ? { date, dateSource: 'inferred' } : {}),
      ...(explicitTime(chunk) ? { time: explicitTime(chunk), timeSource: 'explicit' } : {}),
      ...(durationMinutes(chunk) ? { durationMinutes: durationMinutes(chunk), durationSource: 'explicit' } : {}),
      ...(parseDeadline(chunk, now) ? { deadline: parseDeadline(chunk, now) } : {}),
      ...(reminder ? { reminder } : {}),
      ...(recurrenceValue ? { recurrence: recurrenceValue } : {}),
      ...(naturalNotes(rawText, firstSentence) ? { notes: naturalNotes(rawText, firstSentence) } : {}),
      ...(constraints.length ? { constraints } : {}),
      ...(gerunds.length ? { microtasks: gerunds.map((text) => ({ text, source: 'explicit' })) } : {}),
    };
  });
}

export function parseMindDump(rawText, context = {}, options = {}) {
  const content = String(rawText || '').trim();
  if (!content) return ParsedMindDumpSchema.parse({ rawText: ' ', tasks: [] });
  const now = options.now instanceof Date ? options.now : new Date();
  const fields = extractStructuredFields(content);
  const warnings = [];
  const structured = structuredTask(fields, content, context, now, warnings);
  const tasks = structured ? [structured] : naturalTasks(content, context, now);
  return ParsedMindDumpSchema.parse({ rawText: content, tasks, ...(warnings.length ? { warnings } : {}) });
}