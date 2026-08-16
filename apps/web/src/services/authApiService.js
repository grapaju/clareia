import integratedAiClient from '@/lib/integratedAiClient.js';

const AUTH_TOKEN_KEY = 'clareia_auth_token';
const AUTH_USER_KEY = 'clareia_auth_user';

function safeParse(value, fallback = null) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function getStoredAuthToken() {
  if (typeof window === 'undefined') return '';
  return String(window.localStorage.getItem(AUTH_TOKEN_KEY) || '');
}

export function getStoredAuthUser() {
  if (typeof window === 'undefined') return null;
  return safeParse(window.localStorage.getItem(AUTH_USER_KEY), null);
}

export function saveAuthSession({ token, user }) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, String(token || ''));
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user || null));
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(AUTH_USER_KEY);
}

export async function signupWithApi(payload) {
  return integratedAiClient.fetch('/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function loginWithApi(payload) {
  return integratedAiClient.fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getMeFromApi() {
  return integratedAiClient.fetch('/auth/me', { method: 'GET' });
}

export async function changePasswordWithApi(payload) {
  return integratedAiClient.fetch('/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
