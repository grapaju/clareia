function text(value) {
  return String(value || '').trim();
}

const ACTIVITY_STATUS = new Set(['concluida', 'em_andamento', 'aguardando_retorno', 'pausada']);

function normalizeActivityStatus(value) {
  const normalized = text(value).toLocaleLowerCase('pt-BR').replaceAll(' ', '_');
  return ACTIVITY_STATUS.has(normalized) ? normalized : 'concluida';
}

function normalizeDeliveryLink(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

export function normalizeWrapUpActivities(value) {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item, index) => ({
      id: text(item?.id) || `activity-${index + 1}`,
      description: text(item?.description),
      projectOrFront: text(item?.projectOrFront),
      taskReference: text(item?.taskReference),
      status: normalizeActivityStatus(item?.status),
      nextStep: text(item?.nextStep),
      waitingOn: text(item?.waitingOn),
      durationMinutes: Math.max(0, Number(item?.durationMinutes || 0)) || null,
      deliveryLink: normalizeDeliveryLink(item?.deliveryLink),
    }))
    .filter((item) => item.description || item.nextStep || item.waitingOn);
}

export function buildProfessionalJourneyWrapUp({ concluded = '', continueContext = '', waitingExternal = '', activities = [] } = {}) {
  return {
    concluded: text(concluded),
    continueContext: text(continueContext),
    waitingExternal: text(waitingExternal),
    activities: normalizeWrapUpActivities(activities),
  };
}

export function buildProfessionalJourneyClosingNote(context = {}) {
  const normalized = buildProfessionalJourneyWrapUp(context);
  const activityLines = normalized.activities.map((item) => {
    const statusLabel = {
      concluida: 'concluída',
      em_andamento: 'em andamento',
      aguardando_retorno: 'aguardando retorno',
      pausada: 'pausada',
    }[item.status] || item.status;
    const details = [
      item.projectOrFront && `(${item.projectOrFront})`,
      item.durationMinutes ? `- ${item.durationMinutes} min` : '',
      item.nextStep ? `- próximo passo: ${item.nextStep}` : '',
      item.waitingOn ? `- aguardando: ${item.waitingOn}` : '',
    ].filter(Boolean).join(' ');
    return `- ${item.description} [${statusLabel}]${details ? ` ${details}` : ''}`;
  });

  return [
    normalized.concluded && `Concluído:\n${normalized.concluded}`,
    normalized.continueContext && `Para continuar:\n${normalized.continueContext}`,
    normalized.waitingExternal && `Aguardando retorno externo:\n${normalized.waitingExternal}`,
    activityLines.length > 0 && `Atividades organizadas:\n${activityLines.join('\n')}`,
  ].filter(Boolean).join('\n\n');
}

export function resolveProfessionalJourneyEndAt({ anomalous = false, correctionEnabled = false, correctedEndAt = '', now = new Date() } = {}) {
  if (anomalous && correctionEnabled && correctedEndAt) {
    const corrected = new Date(correctedEndAt);
    if (!Number.isNaN(corrected.getTime())) return corrected.toISOString();
  }
  return new Date(now).toISOString();
}