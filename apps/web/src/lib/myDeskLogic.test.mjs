import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeskScopes, filterDeskItems, scopeLabel } from './myDeskLogic.js';

const items = [
  { id: 'n1', type: 'note', title: 'Revisar campanha', content: 'WhatsApp e chamadas', projectName: 'Corcril', order: 1, createdAt: '2026-09-20T10:00:00Z' },
  { id: 'n2', type: 'note', title: 'Ideia', content: 'Ajustar onboarding', projectName: '', order: 2, createdAt: '2026-09-21T10:00:00Z' },
  { id: 's1', type: 'shortcut', label: 'Drive', url: 'https://drive.example', projectName: '', order: 3, createdAt: '2026-09-22T10:00:00Z' },
  { id: 'p1', type: 'project', projectName: 'Clareia', order: 4, createdAt: '2026-09-23T10:00:00Z' },
];

test('monta escopos com contagens de todas, sem projeto e projetos', () => {
  const scopes = buildDeskScopes(items, [{ name: 'Corcril' }, { name: 'Clareia' }]);
  assert.equal(scopes.find((entry) => entry.id === 'all')?.count, 4);
  assert.equal(scopes.find((entry) => entry.id === 'none')?.count, 2);
  assert.equal(scopes.find((entry) => entry.id === 'project:Corcril')?.count, 1);
  assert.equal(scopes.find((entry) => entry.id === 'project:Clareia')?.count, 1);
});

test('filtra por escopo e busca textual', () => {
  const byProject = filterDeskItems(items, { scope: 'project:Corcril', search: '', sortBy: 'manual' });
  assert.equal(byProject.length, 1);
  assert.equal(byProject[0].id, 'n1');

  const bySearch = filterDeskItems(items, { scope: 'all', search: 'onboarding', sortBy: 'manual' });
  assert.equal(bySearch.length, 1);
  assert.equal(bySearch[0].id, 'n2');
});

test('ordena por manual e por recencia', () => {
  const manual = filterDeskItems(items, { scope: 'all', sortBy: 'manual' });
  assert.deepEqual(manual.map((item) => item.id), ['n1', 'n2', 's1', 'p1']);

  const recentes = filterDeskItems(items, { scope: 'all', sortBy: 'recentes' });
  assert.equal(recentes[0].id, 'p1');

  const antigos = filterDeskItems(items, { scope: 'all', sortBy: 'antigos' });
  assert.equal(antigos[0].id, 'n1');
});

test('resolve rotulo do escopo selecionado', () => {
  const scopes = buildDeskScopes(items, [{ name: 'Corcril' }]);
  assert.equal(scopeLabel(scopes, 'project:Corcril'), 'Corcril');
  assert.equal(scopeLabel(scopes, 'missing'), 'O que está na sua mesa');
});
