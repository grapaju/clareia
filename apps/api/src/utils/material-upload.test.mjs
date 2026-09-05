import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { formatUploadLimit, sanitizeUploadFileName, validateMaterialUpload } from './material-upload.js';

const PNG_HEADER = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const PDF_CONTENT = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');

function uploadFile({ name, mimeType, buffer }) {
  return { originalname: name, mimetype: mimeType, buffer };
}

test('preserva MIME e tamanho obtidos do conteudo', async () => {
  const png = await validateMaterialUpload(uploadFile({ name: 'teste.png', mimeType: 'image/png', buffer: PNG_HEADER }));
  const pdf = await validateMaterialUpload(uploadFile({ name: 'proposta.pdf', mimeType: 'application/pdf', buffer: PDF_CONTENT }));

  assert.equal(png.mimeType, 'image/png');
  assert.equal(png.size, PNG_HEADER.length);
  assert.equal(pdf.mimeType, 'application/pdf');
});

test('aceita texto UTF-8 e CSV sem assinatura binaria', async () => {
  const text = await validateMaterialUpload(uploadFile({ name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('conteudo') }));
  const csv = await validateMaterialUpload(uploadFile({ name: 'dados.csv', mimeType: 'text/csv', buffer: Buffer.from('nome,valor\nA,1') }));

  assert.equal(text.mimeType, 'text/plain');
  assert.equal(csv.mimeType, 'text/csv');
});

test('rejeita MIME divergente e conteudo nao permitido', async () => {
  await assert.rejects(
    () => validateMaterialUpload(uploadFile({ name: 'falso.pdf', mimeType: 'application/pdf', buffer: PNG_HEADER })),
    { status: 415 }
  );
  await assert.rejects(
    () => validateMaterialUpload(uploadFile({ name: 'binario.txt', mimeType: 'text/plain', buffer: Buffer.from([0, 1, 2, 3]) })),
    { status: 415 }
  );
});

test('sanitiza caminho e limita filename', () => {
  assert.equal(sanitizeUploadFileName('../../docs/proposta.pdf'), 'proposta.pdf');
  assert.equal(sanitizeUploadFileName('..\\docs\\imagem.png'), 'imagem.png');
  assert.equal(sanitizeUploadFileName(`${'a'.repeat(200)}.pdf`).length, 180);
  assert.throws(() => sanitizeUploadFileName('../..'), { status: 400 });
});

test('expõe um único limite legível', () => {
  assert.equal(formatUploadLimit(), '25 MB');
});

test('rejeita arquivo maior que 25 MB', async () => {
  await assert.rejects(
    () => validateMaterialUpload(uploadFile({
      name: 'grande.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc((25 * 1024 * 1024) + 1),
    })),
    { status: 413 }
  );
});
