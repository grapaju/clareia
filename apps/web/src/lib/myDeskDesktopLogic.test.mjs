import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMenuEntries,
  computeContextMenuPosition,
  findNextAvailableSlot,
  resolveProjectContext,
} from './myDeskDesktopLogic.js';

test('reposiciona menu contextual perto da borda da tela', () => {
  const position = computeContextMenuPosition({
    anchorX: 1260,
    anchorY: 700,
    menuWidth: 220,
    menuHeight: 260,
    viewportWidth: 1280,
    viewportHeight: 720,
  });
  assert.ok(position.x <= 1052);
  assert.ok(position.y <= 452);
});

test('resolve projeto automaticamente ao criar dentro da pasta', () => {
  const resolved = resolveProjectContext('Clareia', [{ id: 22, name: 'Clareia' }]);
  assert.equal(resolved.projectId, 22);
  assert.equal(resolved.projectName, 'Clareia');

  const none = resolveProjectContext('', [{ id: 22, name: 'Clareia' }]);
  assert.equal(none.projectId, '');
  assert.equal(none.projectName, '');
});

test('novo item encontra posicao livre sem sobrepor o existente', () => {
  const slot = findNextAvailableSlot([
    { type: 'shortcut', x: 16, y: 32 },
    { type: 'shortcut', x: 136, y: 32 },
  ], { itemType: 'shortcut', maxWidth: 600, grid: 16, startX: 16, startY: 32 });

  assert.notEqual(slot.x, 16);
  assert.notEqual(slot.x, 136);
});

test('menu adicionar muda conforme contexto de pasta', () => {
  const root = addMenuEntries('');
  assert.equal(root.length, 4);

  const project = addMenuEntries('Corcril');
  assert.equal(project.length, 4);
  assert.equal(project[0].label, 'Nota neste projeto');
  assert.equal(project[3].label, 'Material do projeto');
});
