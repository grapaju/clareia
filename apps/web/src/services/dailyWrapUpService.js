const DAILY_WRAP_UP_PREFIX = 'clareia_daily_wrap_up';

function safeParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeUserId(userId) {
  const text = String(userId || '').trim();
  return text || 'anonymous';
}

function storageKey(userId) {
  return `${DAILY_WRAP_UP_PREFIX}.${normalizeUserId(userId)}`;
}

function toDateIso(date = new Date()) {
  return date.toISOString().split('T')[0];
}

export function listDailyWrapUps(userId) {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(storageKey(userId)), []);
}

export function saveDailyWrapUp(userId, payload = {}) {
  if (typeof window === 'undefined') return null;

  const all = listDailyWrapUps(userId);
  const record = {
    id: `wrapup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: payload.date || toDateIso(),
    concluded: String(payload.concluded || '').trim(),
    paused: String(payload.paused || '').trim(),
    waitingReturn: String(payload.waitingReturn || '').trim(),
    needsHourLog: Boolean(payload.needsHourLog),
    loggedHours: Number(payload.loggedHours || 0),
    improvementIdea: String(payload.improvementIdea || '').trim(),
    createdAt: new Date().toISOString()
  };

  const next = [record, ...all].slice(0, 90);
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  return record;
}
