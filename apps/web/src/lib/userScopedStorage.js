const AUTH_USER_KEY = 'clareia_auth_user';

function normalizeUserId(userId) {
  return String(userId || '').trim();
}

export function getActiveStorageUserId() {
  if (typeof window === 'undefined') return '';
  try {
    return normalizeUserId(JSON.parse(window.localStorage.getItem(AUTH_USER_KEY) || 'null')?.id);
  } catch {
    return '';
  }
}

export function getUserScopedStorageKey(baseKey, userId = getActiveStorageUserId()) {
  const normalizedUserId = normalizeUserId(userId);
  return normalizedUserId ? `${baseKey}.user.${normalizedUserId}` : '';
}

export function readUserScopedJson(baseKey, fallback, userId) {
  if (typeof window === 'undefined') return fallback;
  const key = getUserScopedStorageKey(baseKey, userId);
  if (!key) return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeUserScopedJson(baseKey, value, userId) {
  if (typeof window === 'undefined') return false;
  const key = getUserScopedStorageKey(baseKey, userId);
  if (!key) return false;
  window.localStorage.setItem(key, JSON.stringify(value));
  return true;
}

export function removeUserScopedItem(baseKey, userId) {
  if (typeof window === 'undefined') return;
  const key = getUserScopedStorageKey(baseKey, userId);
  if (key) window.localStorage.removeItem(key);
}