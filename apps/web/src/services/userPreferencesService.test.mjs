import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUserPreferences, readUserPreferences, saveUserPreferencesLocally } from './userPreferencesService.js';

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  },
  document: {
    documentElement: {
      classList: { toggle: () => {} },
      dataset: {},
    },
  },
};

test('mantem defaults para usuarios existentes sem preferencias', () => {
  const result = normalizeUserPreferences();
  assert.equal(result.onboardingCompleted, false);
  assert.equal(result.visualProfile, 'equilibrado');
  assert.equal(result.maxDailyPriorities, 3);
  assert.equal(result.todayViewMode, 'complete');
  assert.equal(result.textSize, 'confortavel');
  assert.equal(result.microtaskDetail, 'equilibrado');
  assert.equal(result.openingPreference, 'dashboard');
});

test('limita objetivos principais a duas escolhas e preserva secoes parciais', () => {
  const result = normalizeUserPreferences({
    goals: ['Começar', 'Retomar', 'Prazos'],
    notifications: { deadlines: false },
  });
  assert.deepEqual(result.goals, ['Começar', 'Retomar']);
  assert.equal(result.notifications.deadlines, false);
  assert.equal(result.notifications.important, true);
});

test('mantem o modo da tela Hoje separado entre usuarios', () => {
  storage.clear();
  saveUserPreferencesLocally('user-a', { todayViewMode: 'single' });
  saveUserPreferencesLocally('user-b', { todayViewMode: 'complete' });

  assert.equal(readUserPreferences('user-a').todayViewMode, 'single');
  assert.equal(readUserPreferences('user-b').todayViewMode, 'complete');
});

test('persiste o modo tranquilo sem compartilhar a preferencia visual', () => {
  storage.clear();
  saveUserPreferencesLocally('user-a', { visualProfile: 'tranquilo' });
  saveUserPreferencesLocally('user-b', { visualProfile: 'equilibrado' });

  assert.equal(readUserPreferences('user-a').visualProfile, 'tranquilo');
  assert.equal(readUserPreferences('user-b').visualProfile, 'equilibrado');
});

test('isola tamanho, detalhamento e abertura entre usuários', () => {
  storage.clear();
  saveUserPreferencesLocally('user-a', { textSize: 'grande', microtaskDetail: 'detalhado', openingPreference: 'retomada' });
  saveUserPreferencesLocally('user-b', { textSize: 'confortavel', microtaskDetail: 'poucos', openingPreference: 'tranquilo' });

  assert.deepEqual(
    (({ textSize, microtaskDetail, openingPreference }) => ({ textSize, microtaskDetail, openingPreference }))(readUserPreferences('user-a')),
    { textSize: 'grande', microtaskDetail: 'detalhado', openingPreference: 'retomada' }
  );
  assert.deepEqual(
    (({ textSize, microtaskDetail, openingPreference }) => ({ textSize, microtaskDetail, openingPreference }))(readUserPreferences('user-b')),
    { textSize: 'confortavel', microtaskDetail: 'poucos', openingPreference: 'tranquilo' }
  );
});

test('migra opções antigas de tamanho para a escala atual', () => {
  assert.equal(normalizeUserPreferences({ textSize: 'normal' }).textSize, 'confortavel');
  assert.equal(normalizeUserPreferences({ textSize: 'maior' }).textSize, 'grande');
});