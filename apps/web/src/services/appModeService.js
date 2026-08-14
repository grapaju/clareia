const MODE_KEY_PREFIX = 'clareia_app_mode';
const DEV_LOCK_KEY_PREFIX = 'clareia_dev_lock';

const DEFAULT_MODE = 'daily';

export const DEFAULT_DEV_LOCK = {
  mode: 'always',
  startTime: '10:00',
  endTime: '11:00',
  allowedDays: [6]
};

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

function modeStorageKey(userId) {
  return `${MODE_KEY_PREFIX}.${normalizeUserId(userId)}`;
}

function lockStorageKey(userId) {
  return `${DEV_LOCK_KEY_PREFIX}.${normalizeUserId(userId)}`;
}

function normalizeMode(mode) {
  const text = String(mode || '').trim().toLowerCase();
  if (text === 'development') return 'development';
  return 'daily';
}

function normalizeTime(value, fallback) {
  const text = String(value || '').trim();
  if (/^\d{2}:\d{2}$/.test(text)) return text;
  return fallback;
}

function normalizeAllowedDays(value) {
  if (!Array.isArray(value)) return [6];
  const days = value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);

  return days.length > 0 ? Array.from(new Set(days)) : [6];
}

export function readAppMode(userId) {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  const saved = window.localStorage.getItem(modeStorageKey(userId));
  return normalizeMode(saved || DEFAULT_MODE);
}

export function writeAppMode(userId, mode) {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  const normalized = normalizeMode(mode);
  window.localStorage.setItem(modeStorageKey(userId), normalized);
  return normalized;
}

export function readDevelopmentLock(userId) {
  if (typeof window === 'undefined') return { ...DEFAULT_DEV_LOCK };
  const saved = safeParse(window.localStorage.getItem(lockStorageKey(userId)), DEFAULT_DEV_LOCK);
  return {
    mode: ['always', 'hours', 'days'].includes(saved?.mode) ? saved.mode : DEFAULT_DEV_LOCK.mode,
    startTime: normalizeTime(saved?.startTime, DEFAULT_DEV_LOCK.startTime),
    endTime: normalizeTime(saved?.endTime, DEFAULT_DEV_LOCK.endTime),
    allowedDays: normalizeAllowedDays(saved?.allowedDays)
  };
}

export function writeDevelopmentLock(userId, updates = {}) {
  if (typeof window === 'undefined') return { ...DEFAULT_DEV_LOCK };
  const current = readDevelopmentLock(userId);
  const next = {
    ...current,
    ...updates,
    mode: ['always', 'hours', 'days'].includes(updates?.mode) ? updates.mode : current.mode,
    startTime: normalizeTime(updates?.startTime, current.startTime),
    endTime: normalizeTime(updates?.endTime, current.endTime),
    allowedDays: normalizeAllowedDays(updates?.allowedDays ?? current.allowedDays)
  };

  window.localStorage.setItem(lockStorageKey(userId), JSON.stringify(next));
  return next;
}

function timeToMinutes(value) {
  const [h, m] = String(value || '00:00').split(':').map((item) => Number(item));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function isInsideTimeWindow(startTime, endTime, now) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (start === end) return true;
  if (start < end) {
    return nowMinutes >= start && nowMinutes <= end;
  }

  return nowMinutes >= start || nowMinutes <= end;
}

export function isDevelopmentAllowed(lockConfig, now = new Date()) {
  const config = {
    ...DEFAULT_DEV_LOCK,
    ...(lockConfig || {})
  };

  if (config.mode === 'always') {
    return true;
  }

  if (config.mode === 'hours') {
    return isInsideTimeWindow(config.startTime, config.endTime, now);
  }

  const dayAllowed = normalizeAllowedDays(config.allowedDays).includes(now.getDay());
  if (!dayAllowed) return false;

  return isInsideTimeWindow(config.startTime, config.endTime, now);
}
