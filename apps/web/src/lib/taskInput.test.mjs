import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTaskInput, validateTaskInput } from './taskInput.js';

test('valida somente o titulo no cadastro rapido', () => {
  assert.equal(validateTaskInput({ title: '  ' }).valid, false);
  assert.equal(validateTaskInput({ title: 'Enviar proposta' }).valid, true);
});

test('aplica defaults seguros e preserva metadados existentes', () => {
  const result = normalizeTaskInput(
    { title: '  Enviar proposta  ', legacyField: 'preservado' },
    { now: new Date(2026, 7, 23, 14, 0, 0) },
  );

  assert.equal(result.title, 'Enviar proposta');
  assert.equal(result.timeEstimate, 30);
  assert.equal(result.importance, 'Média');
  assert.equal(result.scheduledDate, '2026-08-23');
  assert.equal(result.legacyField, 'preservado');
});