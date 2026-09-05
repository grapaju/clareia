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

export function isFinanceWaitingReturn(item = {}) {
  return item.financeSource === 'fluxo-caixa' && Boolean(String(item.financeInvoiceId || '').trim());
}

export function getWaitingReturnActions(item = {}) {
  if (isFinanceWaitingReturn(item)) {
    return { showComplete: false, showReopen: false, showDelete: false };
  }

  return {
    showComplete: item.status !== 'Concluido',
    showReopen: item.status === 'Concluido',
    showDelete: true,
  };
}

export function countOpenWaitingReturns(items = []) {
  return items.filter(isOpenWaitingReturn).length;
}

export function isOpenWaitingReturn(item = {}) {
  return item.status !== 'Concluido';
}

export function formatFinanceAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatFinanceDueDate(value) {
  const matched = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return '';
  return `${matched[3]}/${matched[2]}/${matched[1]}`;
}