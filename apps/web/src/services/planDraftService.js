import apiClient from '@/lib/apiClient.js';
import { applyPlanningPreferences, parseUnloadMindToPlan } from '@/lib/unloadMindLogic.js';

function normalizeText(value) {
  return String(value || '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

export async function createOrReusePlanDraft({ text, userId, accountId = '', origin = 'plano-clareado', preferences = {} }) {
  const content = String(text || '').trim();
  if (!content || !userId) throw new Error('Texto e usuário são obrigatórios.');

  const plan = applyPlanningPreferences(parseUnloadMindToPlan(content), preferences);
  if (!plan) throw new Error('Não foi possível identificar tarefas.');

  const pendingPlans = await apiClient.collection('planosClareados').getFullList({ sort: '-created' });
  const existing = pendingPlans.find((record) => (
    record?.planoGerado?.meta?.status === 'pending'
    && normalizeText(record?.conteudoOriginal) === normalizeText(content)
  ));
  if (existing) return existing;

  return apiClient.collection('planosClareados').create({
    userId,
    ...(accountId ? { accountId } : {}),
    conteudoOriginal: content,
    planoGerado: {
      ...plan,
      meta: {
        status: 'pending',
        createdAt: new Date().toISOString(),
        textoOriginal: content,
        origin,
        requestId: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
      }
    }
  }, { $autoCancel: false });
}