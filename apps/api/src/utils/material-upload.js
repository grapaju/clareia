import { fileTypeFromBuffer } from 'file-type';
import { MaterialUpload } from '../constants/common.js';

const TEXT_MIME_TYPES = new Set(['text/plain', 'text/csv']);
const MIME_ALIASES = new Map([
  ['application/x-zip-compressed', 'application/zip'],
]);

function createError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeMimeType(value) {
  const mimeType = String(value || '').trim().toLowerCase();
  return MIME_ALIASES.get(mimeType) || mimeType;
}

function isTextBuffer(buffer) {
  if (!buffer?.length) return true;
  if (buffer.includes(0)) return false;

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeUploadFileName(value) {
  const baseName = String(value || '')
    .replace(/^.*[\\/]/, '')
    .split('')
    .filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
    .join('')
    .trim();
  const sanitized = baseName.replace(/[. ]+$/g, '').slice(0, 180);

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    throw createError('Nome de arquivo invalido.', 400);
  }

  return sanitized;
}

export function formatUploadLimit(maxSizeMB = MaterialUpload.MaxSizeMB) {
  return `${maxSizeMB} MB`;
}

export async function validateMaterialUpload(file) {
  if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
    throw createError('Selecione um arquivo para enviar.', 400);
  }

  if (file.buffer.length > MaterialUpload.MaxSizeMB * 1024 * 1024) {
    throw createError(`Este arquivo e maior que o limite permitido de ${formatUploadLimit()}.`, 413);
  }

  const declaredMimeType = normalizeMimeType(file.mimetype);
  const detected = await fileTypeFromBuffer(file.buffer);
  const detectedMimeType = normalizeMimeType(detected?.mime);
  const allowedMimeTypes = new Set(MaterialUpload.AllowedMimeTypes.map(normalizeMimeType));

  let mimeType = detectedMimeType;
  if (!detectedMimeType && TEXT_MIME_TYPES.has(declaredMimeType) && isTextBuffer(file.buffer)) {
    mimeType = declaredMimeType;
  }

  if (!mimeType || !allowedMimeTypes.has(mimeType)) {
    throw createError('Tipo de arquivo nao permitido ou conteudo incompativel.', 415);
  }

  if (detectedMimeType && declaredMimeType && declaredMimeType !== 'application/octet-stream') {
    const declaredIsZipContainer = declaredMimeType === 'application/zip';
    if (declaredMimeType !== detectedMimeType && !declaredIsZipContainer) {
      throw createError('O conteudo do arquivo nao corresponde ao tipo informado.', 415);
    }
  }

  return {
    fileName: sanitizeUploadFileName(file.originalname),
    mimeType,
    size: file.buffer.length,
  };
}
