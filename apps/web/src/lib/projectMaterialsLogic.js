const TYPE_LABELS = {
  file: 'Arquivo',
  link: 'Link',
  note: 'Nota',
  access: 'Acesso',
  drive: 'Drive',
};

function normalizeText(value) {
  return String(value || '').trim();
}

function searchableText(values) {
  return values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => normalizeText(value).toLocaleLowerCase('pt-BR'))
    .filter(Boolean)
    .join(' ');
}

function fileKind(item) {
  const provider = normalizeText(item.provider || item.storageProvider).toLocaleLowerCase('pt-BR');
  const type = normalizeText(item.materialType || item.type).toLocaleLowerCase('pt-BR');
  if (provider.includes('google_drive') || type.includes('drive') || type.includes('google')) return 'drive';
  if (type.includes('link')) return 'link';
  if (type.includes('nota')) return 'note';
  if (type.includes('acesso')) return 'access';
  return 'file';
}

function commonItem(item, kind, entity, overrides = {}) {
  return {
    id: item.id,
    entity,
    kind,
    typeLabel: TYPE_LABELS[kind],
    title: normalizeText(overrides.title || item.name || item.title) || 'Sem título',
    description: normalizeText(overrides.description ?? item.description ?? item.content ?? item.notes),
    url: normalizeText(overrides.url ?? item.url ?? item.externalLink),
    folder: normalizeText(item.folder),
    favorite: Boolean(item.favorite),
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || item.createdAt || '',
    searchText: searchableText(overrides.searchValues || [
      item.name,
      item.title,
      item.description,
      item.content,
      item.notes,
      item.url,
      item.externalLink,
      item.folder,
      item.tags,
      item.type,
      item.platform,
      item.username,
    ]),
    source: item,
  };
}

export function buildProjectItems({ files = [], links = [], notes = [], accesses = [] } = {}) {
  return [
    ...files.map((item) => commonItem(item, fileKind(item), 'file')),
    ...links.map((item) => commonItem(item, 'link', 'link')),
    ...notes.map((item) => commonItem(item, 'note', 'note')),
    ...accesses.map((item) => commonItem(item, 'access', 'access', {
      title: item.title || item.platform,
      description: [item.platform, item.username].filter(Boolean).join(' · '),
      searchValues: [item.title, item.platform, item.url, item.username, item.notes, item.folder],
    })),
  ];
}

export function filterProjectItems(items, type = 'all', folder = '') {
  return items.filter((item) => {
    const matchesType = type === 'all' || item.kind === type;
    const matchesFolder = !folder || item.folder === folder;
    return matchesType && matchesFolder;
  });
}

export function searchProjectItems(items, folders, term, type = 'all') {
  const normalizedTerm = normalizeText(term).toLocaleLowerCase('pt-BR');
  if (!normalizedTerm) return null;

  return {
    items: filterProjectItems(items, type).filter((item) => item.searchText.includes(normalizedTerm)),
    folders: folders.filter((folder) => searchableText([folder.name]).includes(normalizedTerm)),
  };
}

export function getRecentProjectItems(items, limit = 6) {
  return [...items]
    .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime())
    .slice(0, limit);
}

export function getFavoriteProjectItems(items, limit = 6) {
  return items.filter((item) => item.favorite).slice(0, limit);
}

export function getMaterialFilterOptions(items) {
  const counts = items.reduce((result, item) => ({
    ...result,
    [item.kind]: (result[item.kind] || 0) + 1,
  }), {});

  return [
    { value: 'all', label: 'Todos', count: items.length },
    ...Object.entries(TYPE_LABELS)
      .filter(([value]) => counts[value] > 0)
      .map(([value, label]) => ({ value, label: value === 'file' ? 'Arquivos' : `${label}s`, count: counts[value] })),
  ];
}

export function getDrivePresentationState({ connected, projectFolder, loadError } = {}) {
  if (loadError) return { state: 'error', label: 'Não foi possível acessar o Google Drive agora.' };
  if (!connected && projectFolder) return { state: 'attention', label: 'Google Drive precisa ser reconectado.' };
  if (!connected) return { state: 'disconnected', label: 'Google Drive não conectado' };
  if (!projectFolder) return { state: 'connected-no-folder', label: 'Google Drive conectado' };
  return { state: 'connected', label: 'Google Drive conectado' };
}