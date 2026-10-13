import apiClient from '@/lib/apiClient.js';
import { normalizeWrapUpActivities } from '@/lib/professionalJourneyWrapUpLogic.js';

const COLLECTION = 'journey_reviews';

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeRecord(record) {
  if (!record) return null;
  return {
    id: normalizeText(record.id),
    journeyId: normalizeText(record.journeyId),
    date: normalizeText(record.date),
    journeyProjectName: normalizeText(record.journeyProjectName),
    endedAt: record.endedAt || null,
    concluded: normalizeText(record.concluded),
    continueContext: normalizeText(record.continueContext),
    waitingExternal: normalizeText(record.waitingExternal),
    activities: normalizeWrapUpActivities(record.activities),
    status: normalizeText(record.status) || 'pending',
    reviewSavedAt: record.reviewSavedAt || null,
    created: record.created || null,
    updated: record.updated || null,
  };
}

export async function getJourneyReview(journeyId) {
  const id = normalizeText(journeyId);
  if (!id) return null;
  try {
    const item = await apiClient.collection(COLLECTION).getFirstListItem(`journeyId = "${id}"`);
    return normalizeRecord(item);
  } catch {
    return null;
  }
}

export async function saveJourneyReview(payload = {}) {
  const journeyId = normalizeText(payload.journeyId);
  if (!journeyId) throw new Error('journeyId é obrigatório para salvar a revisão.');
  const id = normalizeText(payload.id) || `journey-review-${journeyId}`;
  const persisted = await apiClient.collection(COLLECTION).create({
    id,
    journeyId,
    date: normalizeText(payload.date),
    journeyProjectName: normalizeText(payload.journeyProjectName),
    endedAt: payload.endedAt || null,
    concluded: normalizeText(payload.concluded),
    continueContext: normalizeText(payload.continueContext),
    waitingExternal: normalizeText(payload.waitingExternal),
    activities: normalizeWrapUpActivities(payload.activities),
    status: normalizeText(payload.status) || 'pending',
    reviewSavedAt: payload.reviewSavedAt || new Date().toISOString(),
  });
  return normalizeRecord(persisted);
}

export async function listJourneyReviews({ projectName = '', startDate = '', endDate = '' } = {}) {
  const all = await apiClient.collection(COLLECTION).getFullList({ sort: '-updated' });
  const normalizedProject = normalizeText(projectName).toLocaleLowerCase('pt-BR');
  return all
    .map(normalizeRecord)
    .filter((item) => {
      if (!item) return false;
      if (normalizedProject && normalizeText(item.journeyProjectName).toLocaleLowerCase('pt-BR') !== normalizedProject) return false;
      if (startDate && item.date && item.date < startDate) return false;
      if (endDate && item.date && item.date > endDate) return false;
      return true;
    });
}
