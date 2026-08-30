const PERSONAL_PATTERN = /\b(meu|minha|pessoal|dentista|m[eé]dico|consulta|medicamento|rem[eé]dio|fam[ií]lia|casa|autocuidado|documento pessoal|conta pessoal)\b/i;
const GENERIC_MENTIONS = new Set([
  'cliente', 'projeto', 'site', 'calendario', 'proposta', 'fatura', 'orcamento',
  'reuniao', 'campanha', 'conta', 'documento', 'semana', 'hoje', 'amanha',
  'cobranca', 'enviar', 'alteracao', 'alteracoes'
]);

export function normalizeProjectKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compact(value) {
  return normalizeProjectKey(value).replace(/\s+/g, '');
}

function sourceIncludes(source, candidate) {
  const key = normalizeProjectKey(candidate);
  const compactKey = compact(candidate);
  if (key.length < 3) return false;
  return normalizeProjectKey(source).includes(key) || (compactKey.length >= 4 && compact(source).includes(compactKey));
}

function extractProjectMention(source) {
  const text = String(source || '');
  const patterns = [
    /\bpara\s+(?:a|o)\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9-]*(?:\s+[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9-]*){0,2})/gi,
    /\b(?:da|do|de)\s+([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9-]*(?:\s+[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9-]*){0,2})/gi,
  ];

  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches.reverse()) {
      const words = String(match[1] || '')
        .replace(/[.,;:!?].*$/, '')
        .split(/\s+/)
        .filter(Boolean)
        .filter((word) => !/^(a|o|e|para|com|ap[oó]s|antes|quando|que|se)$/i.test(word));
      const mention = words.slice(0, 2).join(' ').trim();
      if (mention && !GENERIC_MENTIONS.has(normalizeProjectKey(mention))) return mention;
    }
  }

  return '';
}

function findExistingProject(source, projects, aliases) {
  const aliasMatch = [...aliases]
    .sort((a, b) => normalizeProjectKey(b.alias).length - normalizeProjectKey(a.alias).length)
    .find((item) => sourceIncludes(source, item.alias));
  if (aliasMatch) {
    return projects.find((project) => normalizeProjectKey(project.name) === normalizeProjectKey(aliasMatch.projectName)) || null;
  }

  const direct = [...projects]
    .sort((a, b) => normalizeProjectKey(b.name).length - normalizeProjectKey(a.name).length)
    .find((project) => sourceIncludes(source, project.name));
  if (direct) return direct;

  const sourceKey = normalizeProjectKey(source);
  const firstWordMatches = projects.filter((project) => {
    const firstWord = normalizeProjectKey(project.name).split(' ')[0];
    return firstWord.length >= 4 && sourceKey.split(' ').includes(firstWord);
  });
  return firstWordMatches.length === 1 ? firstWordMatches[0] : null;
}

export function resolveProjectAssociation(task, context = {}) {
  const projects = Array.isArray(context.projects) ? context.projects : [];
  const aliases = Array.isArray(context.aliases) ? context.aliases : [];
  const source = String(task?.originalText || task?.title || '').trim();
  const existing = findExistingProject(source, projects, aliases);

  if (existing) {
    const mention = extractProjectMention(source) || existing.name;
    return {
      project: existing.name,
      projectStatus: normalizeProjectKey(existing.name) === 'pessoal' ? 'personal' : 'existing',
      projectMention: mention,
      projectAlias: mention,
    };
  }

  if (PERSONAL_PATTERN.test(source)) {
    return {
      project: 'Pessoal',
      projectStatus: 'personal',
      projectMention: extractProjectMention(source) || source,
      projectAlias: extractProjectMention(source) || source,
    };
  }

  const mention = extractProjectMention(source);
  if (mention) {
    return {
      project: mention,
      projectStatus: 'new',
      projectMention: mention,
      projectAlias: mention,
    };
  }

  return {
    project: '',
    projectStatus: 'undecided',
    projectMention: '',
    projectAlias: '',
  };
}

export function resolvePlanProjectAssociations(tasks, context = {}) {
  return (Array.isArray(tasks) ? tasks : []).map((task) => ({
    ...task,
    ...resolveProjectAssociation(task, context),
  }));
}

export function getProjectStatusLabel(status) {
  if (status === 'existing') return 'Projeto existente';
  if (status === 'new') return 'Projeto novo';
  if (status === 'personal') return 'Pessoal';
  return 'Projeto a decidir';
}