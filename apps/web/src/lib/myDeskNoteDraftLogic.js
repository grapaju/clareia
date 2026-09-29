export function normalizeText(value) {
  return String(value || '').trim();
}

export function hasMeaningfulNoteContent({ title = '', content = '' } = {}) {
  return Boolean(normalizeText(title) || normalizeText(content));
}

export function shouldStartDrag({ startX = 0, startY = 0, currentX = 0, currentY = 0, threshold = 6 } = {}) {
  const deltaX = Number(currentX) - Number(startX);
  const deltaY = Number(currentY) - Number(startY);
  return Math.hypot(deltaX, deltaY) >= Number(threshold);
}

export function buildDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeDraftNote({ position, projectId = '', projectName = '' } = {}) {
  return {
    id: buildDraftId(),
    type: 'note',
    isDraft: true,
    title: '',
    content: '',
    contentFormat: 'richtext',
    color: 'yellow',
    x: Number(position?.x || 20),
    y: Number(position?.y || 24),
    order: Number(position?.order || 0),
    projectId,
    projectName,
  };
}

export function toDraftPersistPayload(note) {
  return {
    type: 'note',
    title: String(note?.title || ''),
    content: String(note?.content || ''),
    contentFormat: String(note?.contentFormat || 'richtext'),
    color: String(note?.color || 'yellow'),
    x: Number(note?.x || 20),
    y: Number(note?.y || 24),
    order: Number(note?.order || 0),
    projectId: note?.projectId || '',
    projectName: note?.projectName || '',
  };
}
