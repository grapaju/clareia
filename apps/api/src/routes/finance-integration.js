import { Router } from 'express';
import { z } from 'zod';
import { runQuery, withTransaction } from '../db/postgres.js';
import { requireAuth } from '../middleware/auth.js';
import { replayPendingFinanceEvents } from '../services/finance-integration.js';

const router = Router();
const uuidSchema = z.string().trim().uuid();

function resultForEvent(eventType, status, duplicateCount = 0) {
  if (status === 'pending_account_mapping') return 'Aguardando conexão da conta';
  if (status === 'pending_client_mapping') return 'Aguardando vínculo com projeto';
  if (status === 'failed') return 'Erro ao processar';
  if (status === 'received') return 'Recebido';
  if (duplicateCount > 0) return 'Já processado';
  if (eventType === 'finance.invoice.sent') return 'Acompanhamento criado';
  if (eventType === 'finance.invoice.overdue') return 'Tarefa criada';
  if (eventType === 'finance.invoice.paid') return 'Acompanhamento encerrado';
  return 'Acompanhamento atualizado';
}

function mapEvent(row) {
  return {
    eventId: row.event_id,
    eventType: row.event_type,
    externalClientId: row.external_client_id,
    clientName: row.client_name,
    invoiceNumber: row.invoice_number,
    status: row.status,
    result: resultForEvent(row.event_type, row.status, row.duplicate_count),
    receivedAt: row.received_at,
    processedAt: row.processed_at,
  };
}

router.use(requireAuth);

router.get('/', async (req, res) => {
  const [account, clients, events] = await Promise.all([
    runQuery(
      `SELECT external_account_id, updated_at
       FROM finance_integration_accounts WHERE user_id = $1 AND source = 'fluxo-caixa'`,
      [req.userId]
    ),
    runQuery(
      `WITH owned_events AS (
         SELECT event.*
         FROM finance_webhook_events AS event
         WHERE event.user_id = $1 OR EXISTS (
           SELECT 1 FROM finance_integration_accounts AS account
           WHERE account.user_id = $1
             AND account.source = event.source
             AND account.external_account_id = event.external_account_id
         )
       ), latest_clients AS (
         SELECT DISTINCT ON (event.payload->'data'->>'externalClientId')
           event.source,
           event.payload->'data'->>'externalClientId' AS external_client_id,
           event.payload->'data'->>'clientName' AS client_name,
           event.received_at
         FROM owned_events AS event
         WHERE event.payload->'data'->>'externalClientId' IS NOT NULL
         ORDER BY event.payload->'data'->>'externalClientId', event.received_at DESC
       )
       SELECT latest.external_client_id, latest.client_name, latest.received_at,
              mapping.project_id,
              COALESCE(project.name, mapping.project_name) AS project_name,
              mapping.updated_at
       FROM latest_clients AS latest
       LEFT JOIN finance_client_project_mappings AS mapping
         ON mapping.user_id = $1
        AND mapping.source = latest.source
        AND mapping.external_client_id::text = latest.external_client_id
       LEFT JOIN project_profiles AS project
         ON project.id = mapping.project_id AND project.user_id = mapping.user_id
       ORDER BY lower(latest.client_name)`,
      [req.userId]
    ),
    runQuery(
      `SELECT event.event_id, event.event_type,
              event.payload->'data'->>'externalClientId' AS external_client_id,
              event.payload->'data'->>'clientName' AS client_name,
              event.payload->'data'->>'invoiceNumber' AS invoice_number,
              event.status, event.duplicate_count, event.received_at, event.processed_at
       FROM finance_webhook_events AS event
       WHERE event.user_id = $1 OR EXISTS (
         SELECT 1 FROM finance_integration_accounts AS account
         WHERE account.user_id = $1
           AND account.source = event.source
           AND account.external_account_id = event.external_account_id
       )
       ORDER BY event.received_at DESC
       LIMIT 20`,
      [req.userId]
    ),
  ]);

  const activity = events.rows.map(mapEvent);
  const mappedClients = clients.rows.map((row) => ({
    externalClientId: row.external_client_id,
    clientName: row.client_name,
    projectId: row.project_id ? Number(row.project_id) : null,
    projectName: row.project_name || '',
    status: row.project_id ? 'mapped' : 'waiting_mapping',
    updatedAt: row.updated_at,
  }));

  res.json({
    account: account.rows[0] ? {
      externalAccountId: account.rows[0].external_account_id,
      updatedAt: account.rows[0].updated_at,
    } : null,
    clients: mappedClients,
    pending: activity.filter((event) => event.status === 'pending_client_mapping'),
    activity,
    summary: {
      lastEventAt: activity[0]?.receivedAt || null,
      pendingClients: mappedClients.filter((client) => !client.projectId).length,
    },
  });
});

router.put('/account', async (req, res) => {
  const accountCode = String(req.body?.externalAccountId || '').trim();
  const webhookSecret = String(process.env.CLAREIA_FINANCE_WEBHOOK_SECRET || '').trim();
  const parsed = uuidSchema.safeParse(accountCode);
  if (!parsed.success || (webhookSecret && accountCode === webhookSecret)) {
    return res.status(400).json({ message: 'Esse codigo nao parece valido. Copie novamente no FluxoCash.' });
  }

  let result;
  try {
    result = await withTransaction(async (client) => {
      const [currentAccount, receivedEvent] = await Promise.all([
        client.query(
          `SELECT external_account_id
           FROM finance_integration_accounts
           WHERE user_id = $1 AND source = 'fluxo-caixa'`,
          [req.userId]
        ),
        client.query(
          `SELECT user_id
           FROM finance_webhook_events
           WHERE source = 'fluxo-caixa' AND external_account_id = $1
           ORDER BY received_at DESC
           LIMIT 1`,
          [parsed.data]
        ),
      ]);
      const isCurrentAccount = currentAccount.rows[0]?.external_account_id === parsed.data;
      if (!isCurrentAccount && !receivedEvent.rows[0]) {
        const error = new Error('Ainda nao encontramos eventos dessa conta no Clareia.');
        error.status = 404;
        throw error;
      }
      if (receivedEvent.rows[0]?.user_id && receivedEvent.rows[0].user_id !== req.userId) {
        const error = new Error('Esta conta ja esta conectada.');
        error.status = 409;
        throw error;
      }

      await client.query(
        `INSERT INTO finance_integration_accounts (user_id, source, external_account_id)
         VALUES ($1, 'fluxo-caixa', $2)
         ON CONFLICT (user_id) DO UPDATE SET
           source = EXCLUDED.source,
           external_account_id = EXCLUDED.external_account_id,
           updated_at = now()`,
        [req.userId, parsed.data]
      );
      return replayPendingFinanceEvents(client, req.userId);
    });
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json({ message: 'Esta conta ja esta conectada.' });
    }
    throw error;
  }

  return res.json({ externalAccountId: parsed.data, eventsApplied: result });
});

router.put('/clients/:externalClientId', async (req, res) => {
  const externalClientId = uuidSchema.safeParse(req.params.externalClientId);
  const projectId = z.coerce.number().int().positive().safeParse(req.body?.projectId);
  if (!externalClientId.success || !projectId.success) {
    return res.status(400).json({ message: 'Cliente externo e projeto sao obrigatorios.' });
  }

  const result = await withTransaction(async (client) => {
    const knownClient = await client.query(
      `SELECT 1
       FROM finance_webhook_events AS event
       JOIN finance_integration_accounts AS account
         ON account.user_id = $1
        AND account.source = event.source
        AND account.external_account_id = event.external_account_id
       WHERE event.payload->'data'->>'externalClientId' = $2
       LIMIT 1`,
      [req.userId, externalClientId.data]
    );
    if (!knownClient.rows[0]) {
      const error = new Error('Cliente do FluxoCash nao encontrado nesta conta.');
      error.status = 404;
      throw error;
    }

    const project = await client.query(
      'SELECT id, name FROM project_profiles WHERE user_id = $1 AND id = $2 LIMIT 1',
      [req.userId, projectId.data]
    );
    if (!project.rows[0]) {
      const error = new Error('Projeto nao encontrado.');
      error.status = 404;
      throw error;
    }

    await client.query(
      `INSERT INTO finance_client_project_mappings (user_id, source, external_client_id, project_id, project_name)
       VALUES ($1, 'fluxo-caixa', $2, $3, $4)
       ON CONFLICT (user_id, source, external_client_id) DO UPDATE SET
         project_id = EXCLUDED.project_id,
         project_name = EXCLUDED.project_name,
         updated_at = now()`,
      [req.userId, externalClientId.data, project.rows[0].id, project.rows[0].name]
    );
    const eventsApplied = await replayPendingFinanceEvents(client, req.userId);
    return { projectName: project.rows[0].name, eventsApplied };
  });

  return res.json({ externalClientId: externalClientId.data, ...result });
});

router.delete('/clients/:externalClientId', async (req, res) => {
  const externalClientId = uuidSchema.safeParse(req.params.externalClientId);
  if (!externalClientId.success) {
    return res.status(400).json({ message: 'Identificador do cliente invalido.' });
  }
  await runQuery(
    `DELETE FROM finance_client_project_mappings
     WHERE user_id = $1 AND source = 'fluxo-caixa' AND external_client_id = $2`,
    [req.userId, externalClientId.data]
  );
  return res.status(204).send();
});

export default router;