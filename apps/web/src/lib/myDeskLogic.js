function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR');
}

function itemProjectName(item) {
  if (item?.type === 'project') return String(item.projectName || '').trim();
  return String(item?.projectName || '').trim();
}

function itemText(item) {
  return [item?.title, item?.content, item?.label, item?.url, itemProjectName(item)].filter(Boolean).join(' ');
}

function timestamp(item, mode = 'recentes') {
  const base = item?.updatedAt || item?.createdAt || 0;
  const ms = new Date(base).getTime() || 0;
  return mode === 'antigos' ? ms : -ms;
}

export function buildDeskScopes(items = [], projects = []) {
  const counts = new Map();

  const increase = (key) => counts.set(key, (counts.get(key) || 0) + 1);

  items.forEach((item) => {
    increase('all');
    const project = itemProjectName(item);
    if (!project) {
      increase('none');
      return;
    }
    increase(`project:${project}`);
  });

  const knownProjects = [...new Set([
    ...projects.map((project) => String(project?.name || '').trim()).filter(Boolean),
    ...items.map((item) => itemProjectName(item)).filter(Boolean),
  ])].sort((left, right) => left.localeCompare(right, 'pt-BR'));

  return [
    { id: 'all', label: 'Todas', count: counts.get('all') || 0 },
    { id: 'none', label: 'Sem projeto', count: counts.get('none') || 0 },
    ...knownProjects.map((name) => ({ id: `project:${name}`, label: name, count: counts.get(`project:${name}`) || 0 })),
  ];
}

export function scopeLabel(scopes = [], scope = 'all') {
  return scopes.find((entry) => entry.id === scope)?.label || 'O que está na sua mesa';
}

export function filterDeskItems(items = [], { scope = 'all', search = '', sortBy = 'recentes' } = {}) {
  const query = normalize(search);

  const filtered = items.filter((item) => {
    const project = itemProjectName(item);
    if (scope === 'none' && project) return false;
    if (scope.startsWith('project:') && project !== scope.slice(8)) return false;
    if (query && !normalize(itemText(item)).includes(query)) return false;
    return true;
  });

  return [...filtered].sort((left, right) => {
    if (sortBy === 'manual') return Number(left.order || 0) - Number(right.order || 0);
    return timestamp(left, sortBy) - timestamp(right, sortBy);
  });
}
