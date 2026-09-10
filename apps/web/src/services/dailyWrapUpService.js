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

export function getLatestDailyWrapUpForResume(userId, referenceDate = new Date(), journeyProjectName = '') {
  const local = new Date(referenceDate);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  const dateIso = local.toISOString().slice(0, 10);
  const normalizedProjectName = String(journeyProjectName || '').trim().toLocaleLowerCase('pt-BR');
  return listDailyWrapUps(userId).find((record) => (
    String(record?.date || '') < dateIso
    && String(record?.continueContext || record?.paused || '').trim()
    && (!normalizedProjectName || String(record?.journeyProjectName || '').trim().toLocaleLowerCase('pt-BR') === normalizedProjectName)
    && record?.resumeState !== 'resolved'
    && record?.resumeState !== 'resumed'
    && (!record?.resumeAfter || String(record.resumeAfter) <= dateIso)
  )) || null;
}

export function updateDailyWrapUpResumeState(userId, recordId, resumeState, referenceDate = new Date()) {
  const records = listDailyWrapUps(userId);
  const index = records.findIndex((record) => record.id === recordId);
  if (index < 0) return null;
  const updated = {
    ...records[index],
    resumeState,
    resumeAfter: resumeState === 'deferred'
      ? new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate() + 1).toISOString().slice(0, 10)
      : null,
    resumeUpdatedAt: new Date().toISOString()
  };
  records[index] = updated;
  replaceDailyWrapUps(userId, records);
  return updated;
}

export function replaceDailyWrapUps(userId, records = []) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(Array.isArray(records) ? records : []));
}

export function saveDailyWrapUp(userId, payload = {}) {
  if (typeof window === 'undefined') return null;

  const all = listDailyWrapUps(userId);
  const continueContext = String(payload.continueContext ?? payload.paused ?? '').trim();
  const waitingExternal = String(payload.waitingExternal ?? payload.waitingReturn ?? '').trim();
  const record = {
    id: `wrapup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: payload.date || toDateIso(),
    concluded: String(payload.concluded || '').trim(),
    continueContext,
    waitingExternal,
    paused: continueContext,
    waitingReturn: waitingExternal,
    endedAt: payload.endedAt || null,
    journeyId: String(payload.journeyId || '').trim() || null,
    journeyProjectName: String(payload.journeyProjectName || '').trim(),
    resumeState: 'pending',
    createdAt: new Date().toISOString()
  };

  const next = [record, ...all].slice(0, 90);
  window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  return record;
}
