function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeText(value) {
  return String(value || '').trim();
}

export function normalizeGoogleDocumentName(name, date = new Date()) {
  const normalized = normalizeText(name);
  if (!normalized) return `Documento-${date.toISOString().slice(0, 10)}`;
  return normalized.replace(/\.txt$/i, '');
}

export function resolveMaterialDriveFolder({ projectId, folderId, rootDriveFolderId, folderLink }) {
  const normalizedFolderId = normalizeText(folderId);
  if (!normalizedFolderId) return normalizeText(rootDriveFolderId) || null;

  if (!folderLink) {
    throw createError('Pasta nao encontrada para este usuario. Sincronize a pasta antes de criar o documento.', 404);
  }
  if (normalizeText(folderLink.projectId) !== normalizeText(projectId)) {
    throw createError('A pasta informada pertence a outro projeto.', 403);
  }

  return normalizeText(folderLink.driveFolderId) || null;
}

export function getDriveMoveParameters({ targetDriveFolderId, currentParents = [] }) {
  const target = normalizeText(targetDriveFolderId);
  const parents = currentParents.map(normalizeText).filter(Boolean);
  const moved = Boolean(target) && !parents.includes(target);

  return {
    moved,
    ...(moved ? { addParents: target, removeParents: parents.join(',') } : {}),
  };
}
