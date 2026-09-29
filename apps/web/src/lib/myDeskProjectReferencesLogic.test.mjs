import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProjectMaterialReferences,
  collectProjectMaterials,
  toReferencePreferenceKey,
} from './myDeskProjectReferencesLogic.js';

test('abrir pasta carrega somente materiais do projectName informado', () => {
  const collected = collectProjectMaterials({
    projectName: 'Clareia',
    files: [{ id: 'f1', projectName: 'Clareia' }, { id: 'f2', projectName: 'Corcril' }],
    links: [{ id: 'l1', projectName: 'Clareia' }],
    notes: [{ id: 'n1', projectName: 'Corcril' }, { id: 'n2', projectName: 'Clareia' }],
  });

  assert.equal(collected.files.length, 1);
  assert.equal(collected.links.length, 1);
  assert.equal(collected.notes.length, 1);
});

test('referencias nao duplicam material real quando o mesmo source aparece duas vezes', () => {
  const result = buildProjectMaterialReferences({
    projectName: 'Clareia',
    files: [
      { id: 'file-1', projectName: 'Clareia', name: 'Briefing.pdf', url: 'https://example.com/a' },
      { id: 'file-1', projectName: 'Clareia', name: 'Briefing.pdf', url: 'https://example.com/a' },
    ],
  });

  const fileRefs = result.items.filter((item) => item.sourceType === 'project-file');
  assert.equal(fileRefs.length, 1);
});

test('atalhos de tarefas e aguardando retorno entram na pasta do projeto', () => {
  const result = buildProjectMaterialReferences({
    projectName: 'Clareia',
    taskCount: 3,
    waitingCount: 2,
  });

  assert.ok(result.items.some((item) => item.sourceType === 'project-tasks'));
  assert.ok(result.items.some((item) => item.sourceType === 'project-waiting'));
});

test('muitos materiais agrupam por tipo quando showAll estiver desligado', () => {
  const files = Array.from({ length: 7 }).map((_, index) => ({
    id: `f-${index}`,
    projectName: 'Clareia',
    name: `Arquivo ${index}`,
    url: `https://example.com/${index}`,
  }));
  const links = Array.from({ length: 5 }).map((_, index) => ({
    id: `l-${index}`,
    projectName: 'Clareia',
    title: `Link ${index}`,
    url: `https://link.com/${index}`,
  }));

  const result = buildProjectMaterialReferences({
    projectName: 'Clareia',
    files,
    links,
    showAll: false,
    threshold: 10,
  });

  assert.equal(result.grouped, true);
  assert.ok(result.items.some((item) => item.sourceType === 'project-material-group'));
});

test('chave de preferencia de referencia combina sourceType e sourceId', () => {
  const key = toReferencePreferenceKey({ sourceType: 'project-file', sourceId: 'f-1' });
  assert.equal(key, 'project-file:f-1');
});
