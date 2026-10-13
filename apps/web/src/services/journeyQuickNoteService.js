import apiClient from '@/lib/apiClient.js';

const COLLECTION = 'journey_quick_notes';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeStatus(value) {
  const status = normalizeText(value).toLocaleLowerCase('pt-BR').replaceAll(' ', '_');
  if (['concluida', 'em_andamento', 'aguardando_retorno', 'pausada'].includes(status)) return status;
  return 'em_andamento';
}

function normalizeQuickNote(item) {
  return {
    id: normalizeText(item?.id),
    journeyId: normalizeText(item?.journeyId),
    journeyProjectName: normalizeText(item?.journeyProjectName),
    date: normalizeText(item?.date),
    description: normalizeText(item?.description),
    projectOrFront: normalizeText(item?.projectOrFront),
    taskReference: normalizeText(item?.taskReference),
    status: normalizeStatus(item?.status),
    nextStep: normalizeText(item?.nextStep),
    waitingOn: normalizeText(item?.waitingOn),
    deliveryLink: normalizeText(item?.deliveryLink),
    created: item?.created || null,
    updated: item?.updated || null,
  };
}

export async function createJourneyQuickNote(payload = {}) {
  const description = normalizeText(payload.description);
  if (!description) throw new Error('Descreva a atividade antes de salvar.');
  const record = await apiClient.collection(COLLECTION).create({
    id: payload.id || `journey-note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    journeyId: normalizeText(payload.journeyId),
    journeyProjectName: normalizeText(payload.journeyProjectName),
    date: normalizeText(payload.date),
    description,
    projectOrFront: normalizeText(payload.projectOrFront),
    taskReference: normalizeText(payload.taskReference),
    status: normalizeStatus(payload.status),
    nextStep: normalizeText(payload.nextStep),
    waitingOn: normalizeText(payload.waitingOn),
    deliveryLink: normalizeText(payload.deliveryLink),
  });
  return normalizeQuickNote(record);
}

export async function updateJourneyQuickNote(id, updates = {}) {
  const noteId = normalizeText(id);
  if (!noteId) throw new Error('ID da anotação é obrigatório.');
  const record = await apiClient.collection(COLLECTION).update(noteId, {
    ...updates,
    status: Object.hasOwn(updates, 'status') ? normalizeStatus(updates.status) : undefined,
  });
  return normalizeQuickNote(record);
}

export async function deleteJourneyQuickNote(id) {
  const noteId = normalizeText(id);
  if (!noteId) return;
  await apiClient.collection(COLLECTION).delete(noteId);
}

export async function listJourneyQuickNotes({ journeyId = '', projectName = '', date = '' } = {}) {
  const all = await apiClient.collection(COLLECTION).getFullList({ sort: '-updated' });
  const normalizedJourneyId = normalizeText(journeyId);
  const normalizedProject = normalizeText(projectName).toLocaleLowerCase('pt-BR');
  const normalizedDate = normalizeText(date);
  return all
    .map(normalizeQuickNote)
    .filter((item) => {
      if (normalizedJourneyId && item.journeyId !== normalizedJourneyId) return false;
      if (normalizedProject && item.journeyProjectName.toLocaleLowerCase('pt-BR') !== normalizedProject) return false;
      if (normalizedDate && item.date !== normalizedDate) return false;
      return true;
    });
}
