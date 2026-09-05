import { Router } from 'express';
import { z } from 'zod';
import { runQuery, withTransaction } from '../db/postgres.js';
import { requireAuth } from '../middleware/auth.js';
import { replayPendingFinanceEvents } from '../services/finance-integration.js';

const router = Router();
const uuidSchema = z.string().uuid();

router.use(requireAuth);

router.get('/', async (req, res) => {
  const [account, clients, pending] = await Promise.all([
    runQuery(
      `SELECT external_account_id, updated_at
       FROM finance_integration_accounts WHERE user_id = $1 AND source = 'fluxo-caixa'`,
      [req.userId]
    ),
    runQuery(
      `SELECT mapping.external_client_id, mapping.project_name, mapping.updated_at,
              COALESCE((
                SELECT event.payload->'data'->>'clientName'
                FROM finance_webhook_events AS event
                WHERE event.user_id = mapping.user_id
                  AND event.source = mapping.source
                  AND event.payload->'data'->>'externalClientId' = mapping.external_client_id::text
                ORDER BY event.received_at DESC
                LIMIT 1
              ), 'Cliente do Fluxo de Caixa') AS client_name
       FROM finance_client_project_mappings AS mapping
       WHERE mapping.user_id = $1 AND mapping.source = 'fluxo-caixa'
      ORDER BY lower(mapping.project_name)`,
      [req.userId]
    ),
    runQuery(
      `SELECT event_type, payload->'data'->>'externalClientId' AS external_client_id,
              payload->'data'->>'clientName' AS client_name, status, received_at
       FROM finance_webhook_events
       WHERE user_id = $1 AND status LIKE 'pending_%'
       ORDER BY received_at DESC`,
      [req.userId]
    ),
  ]);

  res.json({
    account: account.rows[0] ? {
      externalAccountId: account.rows[0].external_account_id,
      updatedAt: account.rows[0].updated_at,
    } : null,
    clients: clients.rows.map((row) => ({
      externalClientId: row.external_client_id,
      clientName: row.client_name,
      projectName: row.project_name,
      updatedAt: row.updated_at,
    })),
    pending: pending.rows.map((row) => ({
      eventType: row.event_type,
      externalClientId: row.external_client_id,
      clientName: row.client_name,
      status: row.status,
      receivedAt: row.received_at,
    })),
  });
});

router.put('/account', async (req, res) => {
  const parsed = uuidSchema.safeParse(req.body?.externalAccountId);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Identificador da conta financeira invalido.' });
  }

  let result;
  try {
    result = await withTransaction(async (client) => {
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
      return res.status(409).json({ message: 'Esta conta do Fluxo de Caixa ja esta vinculada a outro usuario.' });
    }
    throw error;
  }

  return res.json({ externalAccountId: parsed.data, eventsApplied: result });
});

router.put('/clients/:externalClientId', async (req, res) => {
  const externalClientId = uuidSchema.safeParse(req.params.externalClientId);
  const projectName = String(req.body?.projectName || '').trim();
  if (!externalClientId.success || !projectName) {
    return res.status(400).json({ message: 'Cliente externo e projeto sao obrigatorios.' });
  }

  const result = await withTransaction(async (client) => {
    const project = await client.query(
      'SELECT name FROM project_profiles WHERE user_id = $1 AND lower(name) = lower($2) LIMIT 1',
      [req.userId, projectName]
    );
    if (!project.rows[0]) {
      const error = new Error('Projeto nao encontrado.');
      error.status = 404;
      throw error;
    }

    await client.query(
      `INSERT INTO finance_client_project_mappings (user_id, source, external_client_id, project_name)
       VALUES ($1, 'fluxo-caixa', $2, $3)
       ON CONFLICT (user_id, source, external_client_id) DO UPDATE SET
         project_name = EXCLUDED.project_name,
         updated_at = now()`,
      [req.userId, externalClientId.data, project.rows[0].name]
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