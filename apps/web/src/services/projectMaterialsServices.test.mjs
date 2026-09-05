import test from 'node:test';
import assert from 'node:assert/strict';

const values = new Map();
const localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
  clear: () => values.clear(),
};

globalThis.window = { localStorage };

const folders = await import('./projectFolderService.js');
const files = await import('./projectFileService.js');
const links = await import('./projectLinkService.js');
const notes = await import('./projectNoteService.js');
const accesses = await import('./projectAccessService.js');

function useUser(userId) {
  localStorage.setItem('clareia_auth_user', JSON.stringify({ id: userId }));
}

function resetStorage() {
  localStorage.clear();
  useUser('materials-user-a');
}

test('cria pasta somente com nome e preserva a associação dos itens', () => {
  resetStorage();
  const folder = folders.createProjectFolder({ projectName: 'IDT-PR', name: 'Briefing' });
  assert.equal(folder.name, 'Briefing');
  assert.equal(folders.createProjectFolder({ projectName: 'IDT-PR', name: 'Briefing' }), null);

  const file = files.createProjectFile({ projectName: 'IDT-PR', name: 'Briefing.pdf', folder: 'Briefing', favorite: true, relatedTaskId: 'task-1' });
  const link = links.createProjectLink({ projectName: 'IDT-PR', title: 'Site IDT-PR', url: 'https://idtpr.com.br', folder: 'Briefing', relatedTaskIds: ['task-1'] });
  const note = notes.createProjectNote({ projectName: 'IDT-PR', content: 'Cliente pediu ajustes.', folder: 'Briefing', relatedTaskIds: ['task-1'] });

  assert.equal(file.favorite, true);
  assert.equal(file.folder, 'Briefing');
  assert.deepEqual(file.relatedTaskIds, ['task-1']);
  assert.equal(link.folder, 'Briefing');
  assert.deepEqual(link.relatedTaskIds, ['task-1']);
  assert.equal(note.title, '');
  assert.equal(note.folder, 'Briefing');
  assert.deepEqual(note.relatedTaskIds, ['task-1']);
});

test('persiste ids retornados pelo Drive sem exigir campos tecnicos no cadastro', () => {
  resetStorage();
  const folder = folders.createProjectFolder({ projectName: 'Clareia', name: 'Historico' });
  const syncedFolder = folders.updateProjectFolder(folder.id, {
    driveFolderId: 'drive-history-id',
    driveFolderUrl: 'https://drive.google.com/drive/folders/drive-history-id',
  });
  const document = files.createProjectFile({
    projectName: 'Clareia',
    folderId: folder.id,
    folder: 'Historico',
    name: 'Teste Historico 01',
    type: 'documento',
    provider: 'google_drive',
    driveFileId: 'drive-document-id',
    driveFolderId: syncedFolder.driveFolderId,
  });

  assert.equal(syncedFolder.driveFolderId, 'drive-history-id');
  assert.equal(document.driveFileId, 'drive-document-id');
  assert.equal(document.folderId, folder.id);
});

test('edita e exclui arquivo, link e nota', () => {
  resetStorage();
  const file = files.createProjectFile({ projectName: 'IDT-PR', name: 'Arquivo' });
  const link = links.createProjectLink({ projectName: 'IDT-PR', title: 'Link', url: 'https://example.com' });
  const note = notes.createProjectNote({ projectName: 'IDT-PR', content: 'Nota rápida' });

  assert.equal(files.updateProjectFile(file.id, { name: 'Arquivo editado' }).name, 'Arquivo editado');
  assert.equal(links.updateProjectLink(link.id, { title: 'Link editado' }).title, 'Link editado');
  assert.equal(notes.updateProjectNote(note.id, { title: 'Nota editada' }).title, 'Nota editada');
  assert.equal(files.deleteProjectFile(file.id), true);
  assert.equal(links.deleteProjectLink(link.id), true);
  assert.equal(notes.deleteProjectNote(note.id), true);
  assert.deepEqual(files.listProjectFiles('IDT-PR'), []);
  assert.deepEqual(links.listProjectLinks('IDT-PR'), []);
  assert.deepEqual(notes.listProjectNotes('IDT-PR'), []);
});

test('acesso nunca persiste nova senha em texto puro', () => {
  resetStorage();
  const access = accesses.createProjectAccess({
    projectName: 'IDT-PR',
    title: 'WordPress IDT-PR',
    platform: 'WordPress',
    username: 'admin@idtpr.com.br',
    password: 'nao-deve-ser-salva',
    folder: 'Acessos',
  });

  assert.equal(Object.hasOwn(access, 'password'), false);
  const updated = accesses.updateProjectAccess(access.id, { password: 'tambem-nao', notes: 'Senha no Bitwarden' });
  assert.equal(Object.hasOwn(updated, 'password'), false);
  assert.equal(updated.notes, 'Senha no Bitwarden');
});

test('senha legada não é apagada silenciosamente durante edição', () => {
  resetStorage();
  const storageKey = 'clareia_project_accesses_v1.user.materials-user-a';
  localStorage.setItem(storageKey, JSON.stringify([{ id: 'legacy', projectName: 'IDT-PR', title: 'Legado', password: 'valor-legado', relatedTaskIds: [] }]));
  const updated = accesses.updateProjectAccess('legacy', { password: 'tentativa-nova', notes: 'Migrar para cofre' });
  assert.equal(updated.password, 'valor-legado');
  assert.equal(updated.notes, 'Migrar para cofre');
});

test('materiais locais são isolados por usuário', () => {
  resetStorage();
  files.createProjectFile({ projectName: 'IDT-PR', name: 'Privado A' });
  links.createProjectLink({ projectName: 'IDT-PR', title: 'Link A', url: 'https://a.example' });
  notes.createProjectNote({ projectName: 'IDT-PR', content: 'Nota A' });
  accesses.createProjectAccess({ projectName: 'IDT-PR', title: 'Acesso A' });

  useUser('materials-user-b');
  assert.deepEqual(files.listProjectFiles('IDT-PR'), []);
  assert.deepEqual(links.listProjectLinks('IDT-PR'), []);
  assert.deepEqual(notes.listProjectNotes('IDT-PR'), []);
  assert.deepEqual(accesses.listProjectAccesses('IDT-PR'), []);

  useUser('materials-user-a');
  assert.equal(files.listProjectFiles('IDT-PR').length, 1);
  assert.equal(links.listProjectLinks('IDT-PR').length, 1);
  assert.equal(notes.listProjectNotes('IDT-PR').length, 1);
  assert.equal(accesses.listProjectAccesses('IDT-PR').length, 1);
  assert.equal(accesses.deleteProjectAccess(accesses.listProjectAccesses('IDT-PR')[0].id), true);
});