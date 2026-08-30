import integratedAiClient from '../lib/integratedAiClient.js';

export async function createUserSuggestion({ title, message }) {
  const normalizedTitle = String(title || '').trim();
  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) throw new Error('Conte o que você gostaria de sugerir.');

  const result = await integratedAiClient.fetch('/records/user_suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: normalizedTitle || 'Sugestão de usuário',
      message: normalizedMessage,
      status: 'nova',
      source: 'ajuda',
    }),
  });
  return result?.item || null;
}