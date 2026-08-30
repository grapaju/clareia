import integratedAiClient from '@/lib/integratedAiClient.js';

export async function getPlanProjectContext() {
  const result = await integratedAiClient.fetch('/plans/context', { method: 'GET' });
  return {
    projects: Array.isArray(result?.projects) ? result.projects : [],
    aliases: Array.isArray(result?.aliases) ? result.aliases : [],
  };
}

export async function confirmPlan(payload) {
  return integratedAiClient.fetch('/plans/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}