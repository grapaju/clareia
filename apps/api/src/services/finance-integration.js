import { withTransaction } from '../db/postgres.js';
import logger from '../utils/logger.js';

const SOURCE = 'fluxo-caixa';
const WAITING_COLLECTION = 'aguardandoretorno';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function actionFor(event) {
  const { invoiceNumber, clientName, remainingAmount } = event.data;
  if (event.type === 'finance.invoice.overdue') {
    return `Verificar pagamento da fatura ${invoiceNumber} de ${clientName}.`;
  }
  if (event.type === 'finance.invoice.partially_paid') {
    return `Acompanhar saldo de R$ ${remainingAmount} da fatura ${invoiceNumber}.`;
  }
  if (event.type === 'finance.invoice.paid') {
    return `Pagamento da fatura ${invoiceNumber} confirmado.`;
  }
  return `Aguardar pagamento da fatura ${invoiceNumber} de ${clientName}.`;
}

export function buildFinanceOperationalRecords(event, mapping, accountId = '') {
  const completed = event.type === 'finance.invoice.paid';
  const overdue = event.type === 'finance.invoice.overdue';
  const eventDate = event.occurredAt.slice(0, 10);
  const followUpDate = overdue ? today() : (event.data.dueDate || eventDate);
  const action = actionFor(event);
  const taskId = `finance-task-${event.data.invoiceId}`;
  const waitingId = `finance-wait-${event.data.invoiceId}`;
  const common = {
    financeSource: SOURCE,
    financeInvoiceId: event.data.invoiceId,
    externalClientId: event.data.externalClientId,
    invoiceNumber: event.data.invoiceNumber,
    contextUrl: event.data.contextUrl || '',
    totalAmount: event.data.totalAmount,
    paidAmount: event.data.paidAmount,
    remainingAmount: event.data.remainingAmount,
    dueDate: event.data.dueDate || '',
    lastFinanceEventId: event.id,
    lastFinanceEventType: event.type,
    lastFinanceEventOccurredAt: event.occurredAt,
  };

  return {
    task: {
      ...common,
      id: taskId,
      userId: mapping.userId,
      accountId,
      title: overdue ? `Verificar pagamento — ${event.data.clientName}` : `Fatura ${event.data.invoiceNumber} - ${event.data.clientName}`,
      project: mapping.projectName,
      taskType: 'Cobrança',
      nextAction: action,
      dueDate: event.data.dueDate || '',
      dataSugeridaExecucao: followUpDate,
      scheduledDate: followUpDate,
      periodoSugerido: 'Manhã',
      scheduledPeriod: 'Manhã',
      timeEstimate: 15,
      energiaNecessaria: 'Baixa',
      importance: overdue ? 'Alta' : 'Média',
      urgency: overdue ? 'Alta' : 'Média',
      executionDifficulty: 'Direta',
      recurrenceFrequency: 'Nenhuma',
      status: completed ? 'concluida' : (overdue ? 'pendente' : 'aguardando_retorno'),
      ...(completed ? { completedAt: event.occurredAt } : {}),
    },
    waiting: {
      ...common,
      id: waitingId,
      userId: mapping.userId,
      accountId,
      title: `Aguardando pagamento — ${event.data.clientName}`,
      project: mapping.projectName,
      contactName: event.data.clientName,
      waitingFor: completed
        ? `Pagamento recebido da fatura ${event.data.invoiceNumber}`
        : `Pagamento da fatura ${event.data.invoiceNumber}`,
      lastContactDate: eventDate,
      reminderDate: followUpDate,
      nextFollowUp: completed ? '' : action,
      nextFollowUpDate: completed ? '' : followUpDate,
      observations: `Total: R$ ${event.data.totalAmount}. Pago: R$ ${event.data.paidAmount}. Saldo: R$ ${event.data.remainingAmount}.`,
      status: completed ? 'Concluido' : 'Aguardando retorno',
      resolvedAt: completed ? event.occurredAt : '',
      resolutionNote: completed ? 'Resolvido automaticamente pelo FluxoCash' : '',
    },
  };
}

async function applyStoredEvent(client, event) {
  const account = await client.query(
    `SELECT mapping.user_id, users.current_account_id
     FROM finance_integration_accounts AS mapping
     JOIN users ON users.id = mapping.user_id
     WHERE mapping.source = $1 AND mapping.external_account_id = $2
     LIMIT 1`,
    [SOURCE, event.accountId]
  );
  if (!account.rows[0]) {
    await client.query(
      `UPDATE finance_webhook_events
       SET status = 'pending_account_mapping', error_message = 'Conta financeira sem vinculo no Clareia.'
       WHERE event_id = $1`,
      [event.id]
    );
    return 'pending_account_mapping';
  }

  const userId = account.rows[0].user_id;
  const mapping = await client.query(
    `SELECT COALESCE(project.name, mapping.project_name) AS project_name
     FROM finance_client_project_mappings AS mapping
     LEFT JOIN project_profiles AS project
       ON project.id = mapping.project_id AND project.user_id = mapping.user_id
     WHERE mapping.user_id = $1 AND mapping.source = $2 AND mapping.external_client_id = $3
     LIMIT 1`,
    [userId, SOURCE, event.data.externalClientId]
  );
  if (!mapping.rows[0]) {
    await client.query(
      `UPDATE finance_webhook_events
       SET user_id = $2, status = 'pending_client_mapping', error_message = 'Cliente financeiro sem projeto vinculado.'
       WHERE event_id = $1`,
      [event.id, userId]
    );
    return 'pending_client_mapping';
  }

  const records = buildFinanceOperationalRecords(event, {
    userId,
    projectName: mapping.rows[0].project_name,
  }, account.rows[0].current_account_id || '');

  let taskApplied = true;
  if (event.type === 'finance.invoice.paid') {
    await client.query(
      `UPDATE tasks
       SET account_id = $3, data = tasks.data || $4::jsonb, updated_at = now()
       WHERE id = $1 AND user_id = $2`,
      [records.task.id, userId, records.task.accountId, JSON.stringify(records.task)]
    );
  } else if (event.type !== 'finance.invoice.sent') {
    const task = await client.query(
      `INSERT INTO tasks (id, user_id, account_id, data)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         account_id = CASE WHEN
           tasks.data->>'lastFinanceEventType' IS DISTINCT FROM 'finance.invoice.paid'
           AND COALESCE((tasks.data->>'lastFinanceEventOccurredAt')::timestamptz, '-infinity'::timestamptz)
             <= (EXCLUDED.data->>'lastFinanceEventOccurredAt')::timestamptz
           THEN EXCLUDED.account_id ELSE tasks.account_id END,
         data = CASE WHEN
           tasks.data->>'lastFinanceEventType' IS DISTINCT FROM 'finance.invoice.paid'
           AND COALESCE((tasks.data->>'lastFinanceEventOccurredAt')::timestamptz, '-infinity'::timestamptz)
             <= (EXCLUDED.data->>'lastFinanceEventOccurredAt')::timestamptz
           THEN tasks.data || EXCLUDED.data ELSE tasks.data END,
         updated_at = now()
       WHERE tasks.user_id = EXCLUDED.user_id
       RETURNING id`,
      [records.task.id, userId, records.task.accountId, JSON.stringify(records.task)]
    );
    taskApplied = Boolean(task.rows[0]);
  }
  const waiting = await client.query(
    `INSERT INTO app_records (id, collection_name, user_id, account_id, data)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       account_id = CASE WHEN
         EXCLUDED.data->>'lastFinanceEventType' = 'finance.invoice.paid'
         OR (app_records.data->>'lastFinanceEventType' IS DISTINCT FROM 'finance.invoice.paid'
           AND COALESCE((app_records.data->>'lastFinanceEventOccurredAt')::timestamptz, '-infinity'::timestamptz)
             <= (EXCLUDED.data->>'lastFinanceEventOccurredAt')::timestamptz)
         THEN EXCLUDED.account_id ELSE app_records.account_id END,
       data = CASE WHEN
         EXCLUDED.data->>'lastFinanceEventType' = 'finance.invoice.paid'
         OR (app_records.data->>'lastFinanceEventType' IS DISTINCT FROM 'finance.invoice.paid'
           AND COALESCE((app_records.data->>'lastFinanceEventOccurredAt')::timestamptz, '-infinity'::timestamptz)
             <= (EXCLUDED.data->>'lastFinanceEventOccurredAt')::timestamptz)
         THEN app_records.data || EXCLUDED.data ELSE app_records.data END,
       updated_at = now()
     WHERE app_records.collection_name = EXCLUDED.collection_name
       AND app_records.user_id = EXCLUDED.user_id
     RETURNING id`,
    [records.waiting.id, WAITING_COLLECTION, userId, records.waiting.accountId, JSON.stringify(records.waiting)]
  );
  if (!taskApplied || !waiting.rows[0]) {
    throw new Error('Conflito de identificador ao aplicar evento financeiro.');
  }

  await client.query(
    `UPDATE finance_webhook_events
     SET user_id = $2, status = 'applied', error_message = '', processed_at = now()
     WHERE event_id = $1`,
    [event.id, userId]
  );
  return 'applied';
}

export async function receiveFinanceEvent(event) {
  return withTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO finance_webhook_events (
         event_id, source, event_type, external_account_id, status, payload
       ) VALUES ($1, $2, $3, $4, 'received', $5::jsonb)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [event.id, event.source, event.type, event.accountId, JSON.stringify(event)]
    );
    if (!inserted.rows[0]) {
      const existing = await client.query(
        'SELECT status FROM finance_webhook_events WHERE event_id = $1 FOR UPDATE',
        [event.id]
      );
      if (existing.rows[0]?.status !== 'failed') {
        await client.query(
          `UPDATE finance_webhook_events
           SET duplicate_count = duplicate_count + 1
           WHERE event_id = $1`,
          [event.id]
        );
        return { duplicate: true, status: existing.rows[0]?.status || 'received' };
      }
    }

    await client.query('SAVEPOINT finance_event_processing');
    try {
      const status = await applyStoredEvent(client, event);
      await client.query('RELEASE SAVEPOINT finance_event_processing');
      return { duplicate: !inserted.rows[0], status };
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT finance_event_processing');
      await client.query(
        `UPDATE finance_webhook_events
         SET status = 'failed', error_message = 'Falha interna no processamento.'
         WHERE event_id = $1`,
        [event.id]
      );
      logger.error(`Falha ao processar evento financeiro ${event.id}:`, error);
      return { duplicate: !inserted.rows[0], status: 'failed' };
    }
  });
}

export async function replayPendingFinanceEvents(client, userId) {
  const pending = await client.query(
    `SELECT event.payload
     FROM finance_webhook_events AS event
     LEFT JOIN finance_integration_accounts AS account
       ON account.user_id = $1
      AND account.source = event.source
      AND account.external_account_id = event.external_account_id
     WHERE (event.user_id = $1 OR (event.user_id IS NULL AND account.user_id IS NOT NULL))
       AND status IN ('pending_account_mapping', 'pending_client_mapping')
     ORDER BY event.received_at ASC
     FOR UPDATE OF event`,
    [userId]
  );
  let applied = 0;
  for (const row of pending.rows) {
    const status = await applyStoredEvent(client, row.payload);
    if (status === 'applied') applied += 1;
  }
  return applied;
}