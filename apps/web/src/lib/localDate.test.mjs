import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalDate, toIsoDate, toLocalIsoDate } from './localDate.js';

test('toIsoDate preserves date-only strings exactly', () => {
  assert.equal(toIsoDate('2026-07-18'), '2026-07-18');
});

test('parseLocalDate keeps local day for date-only values', () => {
  const date = parseLocalDate('2026-07-18');
  assert.ok(date instanceof Date);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 6);
  assert.equal(date.getDate(), 18);
  assert.equal(toLocalIsoDate(date), '2026-07-18');
});

test('toIsoDate handles Date instances without UTC day drift', () => {
  const localDate = new Date(2026, 6, 18, 15, 30, 0);
  assert.equal(toIsoDate(localDate), '2026-07-18');
});
