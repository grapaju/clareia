function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLocaleLowerCase('pt-BR');
}

function sourceId(kind, id) {
  return `project-ref:${kind}:${id}`;
}

function sourceKey(kind, id) {
  return `${kind}:${id}`;
}

function uniqBySource(records = []) {
  const seen = new Set();
  return records.filter((record) => {
    const key = sourceKey(record.sourceType, record.sourceId);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function collectProjectMaterials({ projectName = '', files = [], links = [], notes = [] } = {}) {
  const target = normalizeKey(projectName);
  const byProject = (item) => normalizeKey(item?.projectName) === target;

  return {
    files: files.filter(byProject),
    links: links.filter(byProject),
    notes: notes.filter(byProject),
  };
}

export function shouldGroupProjectMaterials(total, threshold = 10) {
  return Number(total) > Number(threshold);
}

export function buildProjectMaterialReferences({
  projectName = '',
  files = [],
  links = [],
  notes = [],
  driveConfig = null,
  taskCount = 0,
  waitingCount = 0,
  showAll = false,
  threshold = 10,
} = {}) {
  const materialRefs = uniqBySource([
    ...files.map((item) => ({
      id: sourceId('project-file', item.id),
      type: 'shortcut',
      shortcutKind: 'file',
      label: normalizeText(item.name) || 'Arquivo sem nome',
      url: normalizeText(item.url || item.externalLink) || (normalizeText(item.driveFileId) ? `https://drive.google.com/file/d/${item.driveFileId}/view` : ''),
      sourceType: 'project-file',
      sourceId: item.id,
      sourceEntity: 'file',
      projectName,
      projectId: normalizeText(item.projectId || projectName),
      sourceRecord: item,
      canDeleteSource: true,
    })),
    ...links.map((item) => ({
      id: sourceId('project-link', item.id),
      type: 'shortcut',
      shortcutKind: 'link',
      label: normalizeText(item.title) || 'Link sem titulo',
      url: normalizeText(item.url),
      sourceType: 'project-link',
      sourceId: item.id,
      sourceEntity: 'link',
      projectName,
      projectId: normalizeText(projectName),
      sourceRecord: item,
      canDeleteSource: true,
    })),
    ...notes.map((item) => ({
      id: sourceId('project-note', item.id),
      type: 'note',
      title: normalizeText(item.title),
      content: normalizeText(item.content),
      contentFormat: 'plain',
      color: 'neutral',
      sourceType: 'project-note',
      sourceId: item.id,
      sourceEntity: 'note',
      projectName,
      projectId: normalizeText(projectName),
      sourceRecord: item,
      canDeleteSource: true,
    })),
  ]);

  const baseShortcuts = [];
  if (taskCount > 0) {
    baseShortcuts.push({
      id: sourceId('project-tasks', projectName),
      type: 'shortcut',
      shortcutKind: 'link',
      label: `Tarefas (${taskCount})`,
      url: '',
      sourceType: 'project-tasks',
      sourceId: projectName,
      sourceEntity: 'tasks',
      projectName,
      projectId: normalizeText(projectName),
      canDeleteSource: false,
    });
  }

  if (waitingCount > 0) {
    baseShortcuts.push({
      id: sourceId('project-waiting', projectName),
      type: 'shortcut',
      shortcutKind: 'link',
      label: `Aguardando retorno (${waitingCount})`,
      url: '',
      sourceType: 'project-waiting',
      sourceId: projectName,
      sourceEntity: 'waiting',
      projectName,
      projectId: normalizeText(projectName),
      canDeleteSource: false,
    });
  }

  if (driveConfig?.rootFolderUrl || driveConfig?.rootFolderId) {
    baseShortcuts.push({
      id: sourceId('project-drive-root', projectName),
      type: 'shortcut',
      shortcutKind: 'file',
      label: normalizeText(driveConfig.projectName) ? `Drive: ${driveConfig.projectName}` : 'Pasta do Google Drive',
      url: normalizeText(driveConfig.rootFolderUrl) || `https://drive.google.com/drive/folders/${driveConfig.rootFolderId}`,
      sourceType: 'project-drive-root',
      sourceId: normalizeText(driveConfig.projectId || projectName),
      sourceEntity: 'drive',
      projectName,
      projectId: normalizeText(driveConfig.projectId || projectName),
      canDeleteSource: false,
    });
  }

  const grouped = shouldGroupProjectMaterials(materialRefs.length, threshold) && !showAll;
  if (!grouped) {
    return {
      grouped: false,
      totalMaterials: materialRefs.length,
      items: [...baseShortcuts, ...materialRefs],
    };
  }

  const groups = [
    { type: 'project-file', label: 'Arquivos' },
    { type: 'project-link', label: 'Links' },
    { type: 'project-note', label: 'Notas' },
  ].map((group) => {
    const count = materialRefs.filter((item) => item.sourceType === group.type).length;
    return {
      id: sourceId('project-material-group', group.type),
      type: 'shortcut',
      shortcutKind: 'file',
      label: `${group.label} (${count})`,
      sourceType: 'project-material-group',
      sourceId: group.type,
      sourceEntity: 'material-group',
      projectName,
      projectId: normalizeText(projectName),
      count,
      canDeleteSource: false,
    };
  }).filter((group) => group.count > 0);

  return {
    grouped: true,
    totalMaterials: materialRefs.length,
    items: [...baseShortcuts, ...groups],
  };
}

export function toReferencePreferenceKey(item) {
  return sourceKey(item.sourceType, item.sourceId);
}
