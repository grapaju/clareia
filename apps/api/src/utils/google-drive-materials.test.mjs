import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDriveMoveParameters,
  normalizeGoogleDocumentName,
  resolveMaterialDriveFolder,
} from './google-drive-materials.js';

test('documento sem pasta usa a raiz do projeto', () => {
  assert.equal(resolveMaterialDriveFolder({ projectId: 'Clareia', folderId: '', rootDriveFolderId: 'drive-root-clareia' }), 'drive-root-clareia');
});

test('documentos em Historico e Acessos usam o driveFolderId vinculado', () => {
  assert.equal(resolveMaterialDriveFolder({
    projectId: 'Clareia',
    folderId: 'folder-history',
    rootDriveFolderId: 'drive-root-clareia',
    folderLink: { projectId: 'Clareia', driveFolderId: 'drive-history' },
  }), 'drive-history');
  assert.equal(resolveMaterialDriveFolder({
    projectId: 'Clareia',
    folderId: 'folder-access',
    rootDriveFolderId: 'drive-root-clareia',
    folderLink: { projectId: 'Clareia', driveFolderId: 'drive-access' },
  }), 'drive-access');
});

test('pasta selecionada nunca cai silenciosamente na raiz', () => {
  assert.throws(
    () => resolveMaterialDriveFolder({ projectId: 'Clareia', folderId: 'unknown', rootDriveFolderId: 'drive-root-clareia' }),
    { status: 404 }
  );
});

test('pasta vinculada a outro projeto e rejeitada', () => {
  assert.throws(
    () => resolveMaterialDriveFolder({
      projectId: 'Clareia',
      folderId: 'folder-history',
      rootDriveFolderId: 'drive-root-clareia',
      folderLink: { projectId: 'Outro', driveFolderId: 'drive-history' },
    }),
    { status: 403 }
  );
});

test('troca de pasta gera movimento e edicao comum nao move', () => {
  assert.deepEqual(getDriveMoveParameters({ targetDriveFolderId: 'drive-history', currentParents: ['drive-root-clareia'] }), {
    moved: true,
    addParents: 'drive-history',
    removeParents: 'drive-root-clareia',
  });
  assert.deepEqual(getDriveMoveParameters({ targetDriveFolderId: 'drive-history', currentParents: ['drive-history'] }), {
    moved: false,
  });
});

test('nome de Google Docs nao recebe extensao txt', () => {
  assert.equal(normalizeGoogleDocumentName('Relatorio de teste'), 'Relatorio de teste');
  assert.equal(normalizeGoogleDocumentName('Legado.txt'), 'Legado');
});
