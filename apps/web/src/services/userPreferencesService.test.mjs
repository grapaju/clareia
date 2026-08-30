import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUserPreferences } from './userPreferencesService.js';

test('mantem defaults para usuarios existentes sem preferencias', () => {
  const result = normalizeUserPreferences();
  assert.equal(result.onboardingCompleted, false);
  assert.equal(result.visualProfile, 'equilibrado');
  assert.equal(result.maxDailyPriorities, 3);
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