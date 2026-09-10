function text(value) {
  return String(value || '').trim();
}

export function buildProfessionalJourneyWrapUp({ concluded = '', continueContext = '', waitingExternal = '' } = {}) {
  return {
    concluded: text(concluded),
    continueContext: text(continueContext),
    waitingExternal: text(waitingExternal)
  };
}

export function buildProfessionalJourneyClosingNote(context = {}) {
  const normalized = buildProfessionalJourneyWrapUp(context);
  return [
    normalized.concluded && `Concluído:\n${normalized.concluded}`,
    normalized.continueContext && `Para continuar:\n${normalized.continueContext}`,
    normalized.waitingExternal && `Aguardando retorno externo:\n${normalized.waitingExternal}`
  ].filter(Boolean).join('\n\n');
}

export function resolveProfessionalJourneyEndAt({ anomalous = false, correctionEnabled = false, correctedEndAt = '', now = new Date() } = {}) {
  if (anomalous && correctionEnabled && correctedEndAt) {
    const corrected = new Date(correctedEndAt);
    if (!Number.isNaN(corrected.getTime())) return corrected.toISOString();
  }
  return new Date(now).toISOString();
}