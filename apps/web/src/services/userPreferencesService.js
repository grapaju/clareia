import integratedAiClient from '../lib/integratedAiClient.js';

const STORAGE_PREFIX = 'clareia.userPreferences';
const COLLECTION = 'user_preferences';

export const DEFAULT_USER_PREFERENCES = Object.freeze({
  onboardingCompleted: false,
  onboardingStep: 1,
  onboardingDismissed: false,
  goals: [],
  visualProfile: 'equilibrado',
  todayViewMode: 'complete',
  textSize: 'confortavel',
  microtaskDetail: 'equilibrado',
  openingPreference: 'dashboard',
  density: 'media',
  contrast: 'normal',
  reduceMotion: false,
  hideSecondaryIndicators: false,
  soundsEnabled: false,
  celebrationsEnabled: false,
  theme: 'auto',
  planningMode: 'confirmar',
  checkInFrequency: 'diariamente',
  schedulingMode: 'confirmar',
  comfortableDuration: 30,
  maxDailyPriorities: 3,
  contingencyMargin: 20,
  activeDays: [1, 2, 3, 4, 5],
  preferredPeriods: ['Manhã', 'Tarde'],
  availableTime: '2h',
  notifications: {
    important: true,
    deadlines: true,
    billings: true,
    waitingReturns: true,
  },
  quietHours: { enabled: false, start: '20:00', end: '08:00' },
  integrations: { googleCalendar: false, googleDrive: false },
});

function storageKey(userId) {
  return `${STORAGE_PREFIX}.${userId || 'anonymous'}`;
}

export function normalizeUserPreferences(value = {}) {
  const textSize = value.textSize === 'grande' || value.textSize === 'maior' ? 'grande' : 'confortavel';
  return {
    ...DEFAULT_USER_PREFERENCES,
    ...value,
    textSize,
    goals: Array.isArray(value.goals) ? value.goals.slice(0, 2) : [],
    activeDays: Array.isArray(value.activeDays) ? value.activeDays : DEFAULT_USER_PREFERENCES.activeDays,
    preferredPeriods: Array.isArray(value.preferredPeriods) ? value.preferredPeriods : DEFAULT_USER_PREFERENCES.preferredPeriods,
    notifications: { ...DEFAULT_USER_PREFERENCES.notifications, ...(value.notifications || {}) },
    quietHours: { ...DEFAULT_USER_PREFERENCES.quietHours, ...(value.quietHours || {}) },
    integrations: { ...DEFAULT_USER_PREFERENCES.integrations, ...(value.integrations || {}) },
  };
}

export function applyUserPreferencesToRoot(preferences) {
  if (typeof window === 'undefined') return;
  const next = normalizeUserPreferences(preferences);
  const root = window.document.documentElement;
  root.classList.toggle('reduce-motion', Boolean(next.reduceMotion));
  root.classList.toggle('high-contrast', next.contrast === 'alto');
  root.dataset.textSize = next.textSize;
  root.dataset.density = next.density;
}

export function readUserPreferences(userId) {
  if (typeof window === 'undefined') return normalizeUserPreferences();
  try {
    return normalizeUserPreferences(JSON.parse(window.localStorage.getItem(storageKey(userId)) || '{}'));
  } catch {
    return normalizeUserPreferences();
  }
}

export function saveUserPreferencesLocally(userId, updates) {
  const next = normalizeUserPreferences({ ...readUserPreferences(userId), ...updates, updatedAt: new Date().toISOString() });
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  applyUserPreferencesToRoot(next);
  return next;
}

export async function loadUserPreferences(userId) {
  const local = readUserPreferences(userId);
  try {
    const result = await integratedAiClient.fetch(`/records/${COLLECTION}`, { method: 'GET' });
    const remote = Array.isArray(result?.items) ? result.items[0] : null;
    if (!remote) return local;
    return saveUserPreferencesLocally(userId, { ...remote, id: remote.id });
  } catch {
    return local;
  }
}

export async function saveUserPreferences(userId, updates) {
  const next = saveUserPreferencesLocally(userId, updates);
  const id = next.id || `preferences-${userId}`;
  const payload = { ...next, id, userId };

  try {
    if (next.id) {
      await integratedAiClient.fetch(`/records/${COLLECTION}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await integratedAiClient.fetch(`/records/${COLLECTION}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    return saveUserPreferencesLocally(userId, { ...next, id });
  } catch (error) {
    if (error?.status === 409 || error?.status === 500) {
      try {
        await integratedAiClient.fetch(`/records/${COLLECTION}/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return saveUserPreferencesLocally(userId, { ...next, id });
      } catch {
        return next;
      }
    }
    return next;
  }
}