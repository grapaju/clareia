export function normalizeWaitingReturnInput(payload = {}) {
  const waitingFor = String(payload.waitingFor || '').trim();
  if (!waitingFor) return null;

  return {
    title: waitingFor,
    project: String(payload.project || '').trim(),
    contactName: String(payload.contactName || '').trim(),
    waitingFor,
    lastContactDate: String(payload.lastContactDate || '').trim(),
    reminderDate: String(payload.reminderDate || '').trim(),
    nextFollowUp: String(payload.nextFollowUp || '').trim(),
    nextFollowUpDate: String(payload.nextFollowUpDate || payload.reminderDate || '').trim(),
    observations: String(payload.observations || '').trim(),
    status: String(payload.status || 'Aguardando retorno').trim(),
  };
}