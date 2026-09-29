import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasMeaningfulNoteContent,
  makeDraftNote,
  shouldStartDrag,
  toDraftPersistPayload,
} from './myDeskNoteDraftLogic.js';

test('adicionar nota vazia e sair nao deve persistir', () => {
  assert.equal(hasMeaningfulNoteContent({ title: '   ', content: '   ' }), false);
});

test('adicionar nota com conteudo deve persistir', () => {
  assert.equal(hasMeaningfulNoteContent({ title: '', content: 'Conteudo' }), true);
  assert.equal(hasMeaningfulNoteContent({ title: 'Titulo', content: '' }), true);
});

test('nota draft dentro de projeto recebe projectId e projectName', () => {
  const draft = makeDraftNote({ position: { x: 20, y: 24, order: 1 }, projectId: 7, projectName: 'Clareia' });
  assert.equal(draft.projectId, 7);
  assert.equal(draft.projectName, 'Clareia');
});

test('drag usa threshold para nao confundir clique e arraste', () => {
  assert.equal(shouldStartDrag({ startX: 0, startY: 0, currentX: 2, currentY: 2, threshold: 6 }), false);
  assert.equal(shouldStartDrag({ startX: 0, startY: 0, currentX: 8, currentY: 0, threshold: 6 }), true);
});

test('payload de persistencia do draft contem campos seguros', () => {
  const payload = toDraftPersistPayload({
    title: 'A',
    content: '- [ ] item',
    contentFormat: 'richtext',
    color: 'blue',
    x: 32,
    y: 48,
    order: 2,
    projectId: 10,
    projectName: 'Corcril',
  });
  assert.equal(payload.contentFormat, 'richtext');
  assert.equal(payload.projectId, 10);
  assert.equal(payload.projectName, 'Corcril');
});
