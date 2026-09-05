import { isFinanceWaitingReturn, isOpenWaitingReturn } from './waitingReturnLogic.js';

function parseLocalDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function localDateKey(value = new Date()) {
  const date = startOfLocalDay(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function differenceInLocalDays(dateOnly, referenceDate = new Date()) {
  const date = parseLocalDate(dateOnly);
  if (!date) return null;
  const reference = startOfLocalDay(referenceDate);
  return Math.round((date.getTime() - reference.getTime()) / 86400000);
}

export function getFinanceDuePresentation(dateOnly, referenceDate = new Date(), { overdue = false } = {}) {
  const difference = differenceInLocalDays(dateOnly, referenceDate);
  if (difference === null) return null;
  const formattedDate = parseLocalDate(dateOnly).toLocaleDateString('pt-BR');
  if (overdue) {
    const elapsedDays = Math.max(0, Math.abs(difference));
    return {
      label: elapsedDays > 0 ? `Vencido há ${elapsedDays} ${elapsedDays === 1 ? 'dia' : 'dias'}` : 'Vencido',
      formattedDate,
      state: 'overdue',
    };
  }
  if (difference === 1) return { label: 'Vence amanhã', formattedDate, state: 'tomorrow' };
  if (difference === 0) return { label: 'Vence hoje', formattedDate, state: 'today' };
  if (difference < 0) return { label: `Vencido há ${Math.abs(difference)} ${Math.abs(difference) === 1 ? 'dia' : 'dias'}`, formattedDate, state: 'overdue' };
  return { label: `Vence em ${difference} dias`, formattedDate, state: 'future' };
}

function formatAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })
    : '';
}

export function buildNotificationCenter({ waitingItems = [], savedCount = 0, referenceDate = new Date() } = {}) {
  const openItems = waitingItems.filter(isOpenWaitingReturn);
  const attention = [];

  for (const item of openItems) {
    if (isFinanceWaitingReturn(item)) {
      const due = getFinanceDuePresentation(item.dueDate, referenceDate, {
        overdue: item.lastFinanceEventType === 'finance.invoice.overdue',
      });
      if (!due || !['tomorrow', 'today', 'overdue'].includes(due.state)) continue;
      const type = `finance-due-${due.state}`;
      const client = item.contactName || 'cliente';
      const amount = formatAmount(item.remainingAmount || item.totalAmount);
      const timing = due.state === 'overdue' ? 'está vencida' : due.label.toLocaleLowerCase('pt-BR');
      attention.push({
        id: `${item.financeInvoiceId}:${type}:${item.dueDate}`,
        type,
        title: `${due.state === 'overdue' ? 'Cobrança' : 'Pagamento'} de ${client} ${timing}${amount ? ` — ${amount}` : ''}`,
        href: due.state === 'overdue'
          ? `/?task=finance-task-${encodeURIComponent(item.financeInvoiceId)}`
          : `/aguardando-retorno#${encodeURIComponent(item.id)}`,
        itemId: item.id,
      });
      continue;
    }

    const reminderDate = item.nextFollowUpDate || item.reminderDate;
    const difference = differenceInLocalDays(reminderDate, referenceDate);
    if (difference !== null && difference <= 0) {
      attention.push({
        id: `${item.id}:waiting-reminder:${reminderDate}`,
        type: 'waiting-reminder',
        title: `Verificar retorno de ${item.contactName || item.title || 'acompanhamento'}`,
        href: `/aguardando-retorno#${encodeURIComponent(item.id)}`,
        itemId: item.id,
      });
    }
  }

  return {
    attention,
    tracking: openItems.length > 0 ? [{ id: 'waiting-summary', title: `${openItems.length} ${openItems.length === 1 ? 'item aguardando retorno' : 'itens aguardando retorno'}`, href: '/aguardando-retorno' }] : [],
    organizing: savedCount > 0 ? [{ id: 'saved-summary', title: `${savedCount} ${savedCount === 1 ? 'item guardado' : 'itens guardados'}`, href: '/guardados' }] : [],
  };
}

export function countUnreadAttention(center, readIds = []) {
  const read = new Set(readIds);
  return center.attention.filter((item) => !read.has(item.id)).length;
}