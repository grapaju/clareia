import test from 'node:test';
import assert from 'node:assert/strict';

const requests = [];
const localStorage = {
  getItem: (key) => key === 'clareia_auth_token' ? 'token-teste' : null,
};
globalThis.localStorage = localStorage;
globalThis.window = {
  localStorage,
  fetch: async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ receiptId: 'receipt-1', driveFileId: 'drive-file-1' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

const { uploadGoogleDriveMaterial } = await import('./googleDriveIntegrationService.js');

test('upload envia arquivo e ids internos em multipart sem definir boundary manualmente', async () => {
  requests.length = 0;
  const file = new Blob(['conteudo'], { type: 'text/plain' });

  const result = await uploadGoogleDriveMaterial({
    projectId: 'Projeto A',
    projectType: 'Administrativo',
    folderId: 'folder-interno-1',
    driveFolderId: 'nao-deve-ser-enviado',
    file,
  });

  assert.equal(result.driveFileId, 'drive-file-1');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/hcgi/api/google-drive/materials/upload');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.headers?.['Content-Type'], undefined);
  assert.equal(requests[0].options.body.get('projectId'), 'Projeto A');
  assert.equal(requests[0].options.body.get('folderId'), 'folder-interno-1');
  assert.equal(requests[0].options.body.has('driveFolderId'), false);
  assert.equal(requests[0].options.body.get('file').type, 'text/plain');
});
