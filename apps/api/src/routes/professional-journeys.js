import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { runQuery, withTransaction } from '../db/postgres.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const CATEGORIES = new Set([
  'Desenvolvimento', 'Correção / manutenção', 'Testes', 'Reunião',
  'Análise / planejamento', 'Suporte', 'Administrativo', 'Outro',
]);

function text(value) {
  return String(value || '').trim();
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isoDate(value, fallback = null) {
  const date = value ? new Date(value) : fallback ? new Date(fallback) : new Date();
  if (Number.isNaN(date.getTime())) throw httpError(400, 'Data e hora invalidas.');
  return date.toISOString();
}

function inferCategory(title) {
  const value = text(title).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(reuniao|alinhamento|call|meet)\b/.test(value)) return 'Reunião';
  if (/\b(teste|testar|validar|homolog)\w*/.test(value)) return 'Testes';
  if (/\b(corrigir|correcao|ajustar|manutencao|bug|erro)\w*/.test(value)) return 'Correção / manutenção';
  if (/\b(criar|desenvolver|implementar|programar|modulo|codigo)\w*/.test(value)) return 'Desenvolvimento';
  if (/\b(analisar|planejar|revisar|levantamento|documentacao)\w*/.test(value)) return 'Análise / planejamento';
  if (/\b(suporte|atender|chamado|usuario)\w*/.test(value)) return 'Suporte';
  if (/\b(administrativo|fatura|nota fiscal|relatorio|organizar)\w*/.test(value)) return 'Administrativo';
  return 'Outro';
}

function mapActivity(row) {
  return {
    id: row.id,
    journeyId: row.journey_id,
    projectName: row.project_name,
    taskId: row.task_id || null,
    title: row.title,
    category: row.category,
    source: row.source,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMinutes: Number(row.duration_minutes || 0),
    notes: row.notes || '',
    manuallyEdited: Boolean(row.manually_edited),
  };
}

function mapJourney(row) {
  return {
    id: row.id,
    projectName: row.project_name,
    timezone: row.timezone || 'UTC',
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    closingNote: row.closing_note || '',
    grossMinutes: Number(row.gross_minutes || 0),
    pauseMinutes: Number(row.pause_minutes || 0),
    netMinutes: Number(row.net_minutes || 0),
    activityMinutes: Number(row.activity_minutes || 0),
    unclassifiedMinutes: Math.max(0, Number(row.net_minutes || 0) - Number(row.activity_minutes || 0)),
  };
}

const journeyProjection = `
  SELECT journey.*,
    GREATEST(0, ROUND(EXTRACT(EPOCH FROM (COALESCE(journey.ended_at, now()) - journey.started_at)) / 60)) AS gross_minutes,
    COALESCE((
      SELECT SUM(GREATEST(0, ROUND(EXTRACT(EPOCH FROM (COALESCE(pause.ended_at, now()) - pause.started_at)) / 60)))
      FROM professional_journey_pauses AS pause
      WHERE pause.journey_id = journey.id AND pause.user_id = journey.user_id
    ), 0) AS pause_minutes,
    GREATEST(0,
      ROUND(EXTRACT(EPOCH FROM (COALESCE(journey.ended_at, now()) - journey.started_at)) / 60) -
      COALESCE((
        SELECT SUM(GREATEST(0, ROUND(EXTRACT(EPOCH FROM (COALESCE(pause.ended_at, now()) - pause.started_at)) / 60)))
        FROM professional_journey_pauses AS pause
        WHERE pause.journey_id = journey.id AND pause.user_id = journey.user_id
      ), 0)
    ) AS net_minutes,
    COALESCE((
      SELECT SUM(CASE WHEN activity.ended_at IS NULL
        THEN GREATEST(0, ROUND(EXTRACT(EPOCH FROM (now() - activity.started_at)) / 60))
        ELSE activity.duration_minutes END)
      FROM professional_activities AS activity
      WHERE activity.journey_id = journey.id AND activity.user_id = journey.user_id
    ), 0) AS activity_minutes
  FROM professional_journeys AS journey`;

async function loadJourney(client, journeyId, userId, forUpdate = false) {
  const result = await client.query(
    `SELECT * FROM professional_journeys
     WHERE id = $1 AND user_id = $2${forUpdate ? ' FOR UPDATE' : ''}`,
    [journeyId, userId]
  );
  if (!result.rows[0]) throw httpError(404, 'Jornada nao encontrada.');
  return result.rows[0];
}

async function closeActiveActivity(client, userId, endedAt) {
  await client.query(
    `UPDATE professional_activities
     SET ended_at = $1,
         duration_minutes = GREATEST(0, ROUND(EXTRACT(EPOCH FROM ($1::timestamptz - started_at)) / 60)),
         updated_at = now()
     WHERE user_id = $2 AND ended_at IS NULL`,
    [endedAt, userId]
  );
}

router.use(requireAuth);

router.get('/', async (req, res) => {
  const projectName = text(req.query?.projectName);
  const startDate = req.query?.startDate ? isoDate(`${req.query.startDate}T00:00:00`) : null;
  const endDate = req.query?.endDate ? isoDate(`${req.query.endDate}T23:59:59.999`) : null;
  const params = [req.userId, projectName, startDate, endDate];
  const [journeys, activities, edits] = await Promise.all([
    runQuery(
      `${journeyProjection}
       WHERE journey.user_id = $1
         AND ($2 = '' OR lower(journey.project_name) = lower($2))
         AND ($3::timestamptz IS NULL OR COALESCE(journey.ended_at, now()) >= $3)
         AND ($4::timestamptz IS NULL OR journey.started_at <= $4)
       ORDER BY journey.started_at DESC`, params
    ),
    runQuery(
      `SELECT * FROM professional_activities
       WHERE user_id = $1
         AND ($2 = '' OR lower(project_name) = lower($2))
         AND ($3::timestamptz IS NULL OR COALESCE(ended_at, now()) >= $3)
         AND ($4::timestamptz IS NULL OR started_at <= $4)
       ORDER BY started_at DESC`, params
    ),
    runQuery(
      `SELECT edit.id, edit.activity_id, edit.previous_data, edit.corrected_data, edit.reason, edit.edited_at
       FROM professional_activity_edits AS edit
       JOIN professional_activities AS activity ON activity.id = edit.activity_id AND activity.user_id = edit.user_id
       WHERE edit.user_id = $1
         AND ($2 = '' OR lower(activity.project_name) = lower($2))
         AND ($3::timestamptz IS NULL OR activity.started_at >= $3)
         AND ($4::timestamptz IS NULL OR activity.started_at <= $4)
       ORDER BY edit.edited_at DESC`, params
    ),
  ]);
  res.json({
    journeys: journeys.rows.map(mapJourney),
    activities: activities.rows.map(mapActivity),
    edits: edits.rows.map((row) => ({
      id: row.id, activityId: row.activity_id, previousData: row.previous_data,
      correctedData: row.corrected_data, reason: row.reason || '', editedAt: row.edited_at,
    })),
  });
});

router.get('/current', async (req, res) => {
  const projectName = text(req.query?.projectName);
  const result = await runQuery(
    `${journeyProjection}
     WHERE journey.user_id = $1 AND journey.status IN ('active', 'paused')
       AND ($2 = '' OR lower(journey.project_name) = lower($2))
     ORDER BY journey.started_at DESC LIMIT 1`,
    [req.userId, projectName]
  );
  if (!result.rows[0]) return res.json({ item: null, pauses: [], activities: [] });
  const journey = result.rows[0];
  const [pauses, activities] = await Promise.all([
    runQuery(
      `SELECT id, journey_id, category, started_at, ended_at FROM professional_journey_pauses
       WHERE journey_id = $1 AND user_id = $2 ORDER BY started_at`, [journey.id, req.userId]
    ),
    runQuery(
      'SELECT * FROM professional_activities WHERE journey_id = $1 AND user_id = $2 ORDER BY started_at',
      [journey.id, req.userId]
    ),
  ]);
  res.json({
    item: mapJourney(journey),
    pauses: pauses.rows.map((row) => ({ id: row.id, journeyId: row.journey_id, category: row.category || '', startedAt: row.started_at, endedAt: row.ended_at })),
    activities: activities.rows.map(mapActivity),
  });
});

router.post('/', async (req, res) => {
  const projectName = text(req.body?.projectName);
  const timezone = text(req.body?.timezone) || 'UTC';
  const startedAt = isoDate(req.body?.startedAt);
  const idempotencyKey = text(req.body?.idempotencyKey);
  if (!projectName) return res.status(400).json({ message: 'Projeto e obrigatorio.' });

  const result = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`professional-journey:${req.userId}`]);
    const profile = await client.query(
      `SELECT name, timezone FROM project_profiles
       WHERE user_id = $1 AND lower(name) = lower($2) AND professional_tracking_enabled = true LIMIT 1`,
      [req.userId, projectName]
    );
    if (!profile.rows[0]) throw httpError(409, 'Ative a jornada profissional neste projeto antes de iniciar.');
    const existing = await client.query(
      `SELECT * FROM professional_journeys
       WHERE user_id = $1 AND status IN ('active', 'paused') LIMIT 1`,
      [req.userId]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].project_name.toLocaleLowerCase('pt-BR') !== profile.rows[0].name.toLocaleLowerCase('pt-BR')) {
        throw httpError(409, `Encerre a jornada de ${existing.rows[0].project_name} antes de iniciar outra.`);
      }
      return { row: existing.rows[0], alreadyRunning: true };
    }
    const id = `journey-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const created = await client.query(
      `INSERT INTO professional_journeys
       (id, user_id, account_id, project_name, timezone, started_at, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [id, req.userId, text(req.authUser?.accountId), profile.rows[0].name,
       timezone === 'UTC' && profile.rows[0].timezone ? profile.rows[0].timezone : timezone, startedAt, idempotencyKey]
    );
    return { row: created.rows[0], alreadyRunning: false };
  });
  res.status(result.alreadyRunning ? 200 : 201).json({ item: mapJourney(result.row), alreadyRunning: result.alreadyRunning });
});

router.post('/:journeyId/pause', async (req, res) => {
  const pausedAt = isoDate(req.body?.pausedAt);
  const item = await withTransaction(async (client) => {
    const journey = await loadJourney(client, req.params.journeyId, req.userId, true);
    if (journey.status === 'paused') return journey;
    if (journey.status !== 'active') throw httpError(409, 'A jornada ja foi encerrada.');
    await closeActiveActivity(client, req.userId, pausedAt);
    await client.query(
      `INSERT INTO professional_journey_pauses (id, journey_id, user_id, category, started_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [`pause-${Date.now()}-${randomUUID().slice(0, 8)}`, journey.id, req.userId, text(req.body?.category), pausedAt]
    );
    const updated = await client.query(
      "UPDATE professional_journeys SET status = 'paused', updated_at = now() WHERE id = $1 RETURNING *", [journey.id]
    );
    return updated.rows[0];
  });
  res.json({ item: mapJourney(item) });
});

router.post('/:journeyId/resume', async (req, res) => {
  const resumedAt = isoDate(req.body?.resumedAt);
  const item = await withTransaction(async (client) => {
    const journey = await loadJourney(client, req.params.journeyId, req.userId, true);
    if (journey.status === 'active') return journey;
    if (journey.status !== 'paused') throw httpError(409, 'A jornada ja foi encerrada.');
    await client.query(
      `UPDATE professional_journey_pauses SET ended_at = $1, updated_at = now()
       WHERE journey_id = $2 AND user_id = $3 AND ended_at IS NULL`,
      [resumedAt, journey.id, req.userId]
    );
    const updated = await client.query(
      "UPDATE professional_journeys SET status = 'active', updated_at = now() WHERE id = $1 RETURNING *", [journey.id]
    );
    return updated.rows[0];
  });
  res.json({ item: mapJourney(item) });
});

router.post('/:journeyId/close', async (req, res) => {
  const endedAt = isoDate(req.body?.endedAt);
  const item = await withTransaction(async (client) => {
    const journey = await loadJourney(client, req.params.journeyId, req.userId, true);
    if (journey.status === 'closed') return journey;
    if (new Date(endedAt) < new Date(journey.started_at)) throw httpError(400, 'O encerramento deve ocorrer depois do inicio.');
    await closeActiveActivity(client, req.userId, endedAt);
    await client.query(
      `UPDATE professional_journey_pauses SET ended_at = $1, updated_at = now()
       WHERE journey_id = $2 AND user_id = $3 AND ended_at IS NULL`, [endedAt, journey.id, req.userId]
    );
    const updated = await client.query(
      `UPDATE professional_journeys
       SET status = 'closed', ended_at = $1, closing_note = $2, updated_at = now()
       WHERE id = $3 RETURNING *`, [endedAt, text(req.body?.closingNote), journey.id]
    );
    return updated.rows[0];
  });
  res.json({ item: mapJourney(item) });
});

router.post('/:journeyId/activities', async (req, res) => {
  const title = text(req.body?.title);
  const source = ['task', 'quick', 'manual', 'timer'].includes(req.body?.source) ? req.body.source : 'quick';
  const startedAt = isoDate(req.body?.startedAt);
  const endedAt = source === 'manual' ? isoDate(req.body?.endedAt) : null;
  const idempotencyKey = text(req.body?.idempotencyKey);
  if (!title) return res.status(400).json({ message: 'Atividade e obrigatoria.' });
  if (endedAt && new Date(endedAt) <= new Date(startedAt)) return res.status(400).json({ message: 'O fim deve ocorrer depois do inicio.' });

  const result = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`professional-activity:${req.userId}`]);
    const journey = await loadJourney(client, req.params.journeyId, req.userId, true);
    if (journey.status !== 'active' && source !== 'manual') throw httpError(409, 'Retome a jornada antes de iniciar uma atividade.');
    if (new Date(startedAt) < new Date(journey.started_at)) throw httpError(400, 'A atividade deve ocorrer dentro da jornada.');
    if (source === 'manual' && journey.ended_at && new Date(endedAt) > new Date(journey.ended_at)) {
      throw httpError(400, 'A atividade deve ocorrer dentro da jornada.');
    }
    if (req.body?.taskId) {
      const task = await client.query('SELECT id FROM tasks WHERE id = $1 AND user_id = $2', [text(req.body.taskId), req.userId]);
      if (!task.rows[0]) throw httpError(404, 'Tarefa nao encontrada.');
    }
    if (idempotencyKey) {
      const existing = await client.query(
        'SELECT * FROM professional_activities WHERE user_id = $1 AND idempotency_key = $2 LIMIT 1',
        [req.userId, idempotencyKey]
      );
      if (existing.rows[0]) return { row: existing.rows[0], alreadyRecorded: true };
    }
    if (source !== 'manual') await closeActiveActivity(client, req.userId, startedAt);
    const category = CATEGORIES.has(req.body?.category) ? req.body.category : inferCategory(title);
    const id = `activity-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const created = await client.query(
      `INSERT INTO professional_activities
       (id, journey_id, user_id, account_id, project_name, task_id, work_session_id, title,
        category, source, started_at, ended_at, duration_minutes, notes, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
         CASE WHEN $12::timestamptz IS NULL THEN 0 ELSE GREATEST(0, ROUND(EXTRACT(EPOCH FROM ($12::timestamptz - $11::timestamptz)) / 60)) END,
         $13, $14) RETURNING *`,
      [id, journey.id, req.userId, text(req.authUser?.accountId), journey.project_name,
       text(req.body?.taskId) || null, text(req.body?.workSessionId) || null, title, category,
       source, startedAt, endedAt, text(req.body?.notes), idempotencyKey]
    );
    return { row: created.rows[0], alreadyRecorded: false };
  });
  res.status(result.alreadyRecorded ? 200 : 201).json({ item: mapActivity(result.row), alreadyRecorded: result.alreadyRecorded });
});

router.patch('/activities/:activityId', async (req, res) => {
  const item = await withTransaction(async (client) => {
    const found = await client.query(
      'SELECT * FROM professional_activities WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [req.params.activityId, req.userId]
    );
    const current = found.rows[0];
    if (!current) throw httpError(404, 'Atividade nao encontrada.');
    const startedAt = req.body?.startedAt ? isoDate(req.body.startedAt) : current.started_at;
    const endedAt = req.body?.endedAt ? isoDate(req.body.endedAt) : current.ended_at;
    if (!endedAt || new Date(endedAt) <= new Date(startedAt)) throw httpError(400, 'Informe um intervalo encerrado e valido.');
    const corrected = {
      title: text(req.body?.title) || current.title,
      category: CATEGORIES.has(req.body?.category) ? req.body.category : current.category,
      startedAt,
      endedAt,
      notes: Object.hasOwn(req.body || {}, 'notes') ? text(req.body.notes) : current.notes,
    };
    const previous = mapActivity(current);
    await client.query(
      `INSERT INTO professional_activity_edits
       (activity_id, user_id, edited_by, previous_data, corrected_data, reason)
       VALUES ($1, $2, $2, $3::jsonb, $4::jsonb, $5)`,
      [current.id, req.userId, JSON.stringify(previous), JSON.stringify(corrected), text(req.body?.reason)]
    );
    const updated = await client.query(
      `UPDATE professional_activities
       SET title = $1, category = $2, started_at = $3, ended_at = $4,
           duration_minutes = GREATEST(0, ROUND(EXTRACT(EPOCH FROM ($4::timestamptz - $3::timestamptz)) / 60)),
           notes = $5, manually_edited = true,
           original_data = COALESCE(original_data, $6::jsonb), updated_at = now()
       WHERE id = $7 AND user_id = $8 RETURNING *`,
      [corrected.title, corrected.category, startedAt, endedAt, corrected.notes,
       JSON.stringify(previous), current.id, req.userId]
    );
    return updated.rows[0];
  });
  res.json({ item: mapActivity(item) });
});

export default router;