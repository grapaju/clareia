import { integratedAiClient } from '@/lib/integratedAiClient.js';

export async function getFinanceIntegration() {
  return integratedAiClient.fetch('/finance-integration');
}

export async function saveFinanceAccount(externalAccountId) {
  return integratedAiClient.fetch('/finance-integration/account', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ externalAccountId }),
  });
}

export async function saveFinanceClientMapping(externalClientId, projectId) {
  return integratedAiClient.fetch(`/finance-integration/clients/${encodeURIComponent(externalClientId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  });
}