import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProjectItems,
  filterProjectItems,
  getDrivePresentationState,
  getFavoriteProjectItems,
  getMaterialFilterOptions,
  getRecentProjectItems,
  searchProjectItems,
} from './projectMaterialsLogic.js';

const data = {
  files: [
    { id: 'file-1', name: 'Briefing IDT', type: 'pdf', folder: 'Briefing', favorite: true, updatedAt: '2026-09-01T10:00:00Z' },
    { id: 'drive-1', name: 'Layout', provider: 'google_drive', updatedAt: '2026-09-03T10:00:00Z' },
  ],
  links: [{ id: 'link-1', title: 'Site IDT-PR', url: 'https://idtpr.com.br', folder: 'Publicação', updatedAt: '2026-09-02T10:00:00Z' }],
  notes: [{ id: 'note-1', title: 'Alterações solicitadas', content: 'Cliente IDT pediu ajustes', updatedAt: '2026-08-30T10:00:00Z' }],
  accesses: [{ id: 'access-1', title: 'WordPress IDT-PR', username: 'admin@idtpr.com.br', password: 'segredo-nao-indexar', updatedAt: '2026-08-29T10:00:00Z' }],
};

test('normaliza arquivos, links, notas, acessos e Drive como itens do projeto', () => {
  const items = buildProjectItems(data);
  assert.deepEqual(items.map((item) => item.kind), ['file', 'drive', 'link', 'note', 'access']);
});

test('busca encontra tipos diferentes e identifica cada resultado', () => {
  const result = searchProjectItems(buildProjectItems(data), [], 'IDT');
  assert.deepEqual(result.items.map((item) => item.typeLabel), ['Arquivo', 'Link', 'Nota', 'Acesso']);
});

test('busca encontra pasta sem misturar sua identificação', () => {
  const result = searchProjectItems(buildProjectItems(data), [{ id: 'folder-1', name: 'Briefing' }], 'brief');
  assert.equal(result.folders[0].name, 'Briefing');
});

test('busca nunca indexa senha legada', () => {
  const result = searchProjectItems(buildProjectItems(data), [], 'segredo-nao-indexar');
  assert.equal(result.items.length, 0);
});

test('filtra por tipo e por pasta', () => {
  const items = buildProjectItems(data);
  assert.deepEqual(filterProjectItems(items, 'link', 'Publicação').map((item) => item.id), ['link-1']);
});

test('recentes usam data de atualização sem inventar acessos', () => {
  assert.deepEqual(getRecentProjectItems(buildProjectItems(data), 2).map((item) => item.id), ['drive-1', 'link-1']);
});

test('favoritos aparecem apenas quando existem', () => {
  assert.deepEqual(getFavoriteProjectItems(buildProjectItems(data)).map((item) => item.id), ['file-1']);
  assert.deepEqual(getFavoriteProjectItems(buildProjectItems({})), []);
});

test('filtros omitem categorias vazias', () => {
  const options = getMaterialFilterOptions(buildProjectItems({ links: data.links }));
  assert.deepEqual(options.map((option) => option.value), ['all', 'link']);
});

test('Drive não conectado tem ação inicial clara', () => {
  assert.equal(getDrivePresentationState({ connected: false }).state, 'disconnected');
});

test('Drive conectado sem pasta separa conexão de escolha de pasta', () => {
  assert.equal(getDrivePresentationState({ connected: true }).state, 'connected-no-folder');
});

test('Drive conectado com pasta fica discreto', () => {
  assert.equal(getDrivePresentationState({ connected: true, projectFolder: { id: 'folder' } }).state, 'connected');
});

test('pasta existente sem conexão solicita reconexão', () => {
  assert.equal(getDrivePresentationState({ connected: false, projectFolder: { id: 'folder' } }).state, 'attention');
});

test('falha temporária do Drive não é apresentada como OAuth', () => {
  const result = getDrivePresentationState({ loadError: true });
  assert.equal(result.state, 'error');
  assert.doesNotMatch(result.label, /oauth|token/i);
});