import { readUserScopedJson, writeUserScopedJson } from '../lib/userScopedStorage.js';

const STORAGE_KEY = 'clareia_read_notifications_v1';

export function listReadNotificationIds(userId) {
  const value = readUserScopedJson(STORAGE_KEY, [], userId);
  return Array.isArray(value) ? value.map(String) : [];
}

export function markNotificationRead(notificationId, userId) {
  const current = listReadNotificationIds(userId);
  const next = [...new Set([...current, String(notificationId)])];
  writeUserScopedJson(STORAGE_KEY, next, userId);
  return next;
}

export function retainActiveNotificationReads(notificationIds, userId) {
  const active = new Set(notificationIds.map(String));
  const next = listReadNotificationIds(userId).filter((id) => active.has(id));
  writeUserScopedJson(STORAGE_KEY, next, userId);
  return next;
}