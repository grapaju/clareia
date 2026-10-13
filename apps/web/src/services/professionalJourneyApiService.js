import { integratedAiClient } from '@/lib/integratedAiClient.js';

async function request(path, method = 'GET', body) {
  return integratedAiClient.fetch(path, {
    method,
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
}

export const getCurrentProfessionalJourney = (projectName = '') => request(`/professional-journeys/current${projectName ? `?projectName=${encodeURIComponent(projectName)}` : ''}`);
export const listProfessionalJourneys = (query = '') => request(`/professional-journeys${query ? `?${query}` : ''}`);
export const startProfessionalJourney = (payload) => request('/professional-journeys', 'POST', payload);
export const pauseProfessionalJourney = (journeyId, payload = {}) => request(`/professional-journeys/${journeyId}/pause`, 'POST', payload);
export const resumeProfessionalJourney = (journeyId, payload = {}) => request(`/professional-journeys/${journeyId}/resume`, 'POST', payload);
export const closeProfessionalJourney = (journeyId, payload = {}) => request(`/professional-journeys/${journeyId}/close`, 'POST', payload);
export const updateProfessionalJourney = (journeyId, payload = {}) => request(`/professional-journeys/${journeyId}`, 'PATCH', payload);
export const deleteProfessionalJourney = (journeyId) => request(`/professional-journeys/${journeyId}`, 'DELETE');
export const createProfessionalPause = (journeyId, payload = {}) => request(`/professional-journeys/${journeyId}/pauses`, 'POST', payload);
export const updateProfessionalPause = (pauseId, payload = {}) => request(`/professional-journeys/pauses/${pauseId}`, 'PATCH', payload);
export const deleteProfessionalPause = (pauseId) => request(`/professional-journeys/pauses/${pauseId}`, 'DELETE');
export const updateProfessionalActivity = (activityId, payload = {}) => request(`/professional-journeys/activities/${activityId}`, 'PATCH', payload);
export const deleteProfessionalActivity = (activityId) => request(`/professional-journeys/activities/${activityId}`, 'DELETE');
