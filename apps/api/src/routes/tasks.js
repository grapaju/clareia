import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { runQuery, withTransaction } from '../db/postgres.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function normalizeText(value) {
  return String(value || '').trim();
}

function buildTaskRecord(row) {
  const data = row.data || {};
  return {
    ...data,
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id || data.accountId || '',
    created: row.created_at,
    updated: row.updated_at,
  };
}

router.use(requireAuth);

router.get('/', async (req, res) => {
  const result = await runQuery(
    `SELECT id, user_id, account_id, data, created_at, updated_at
     FROM tasks
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [req.userId]
  );

  res.json({ items: result.rows.map(buildTaskRecord) });
});

router.post('/', async (req, res) => {
  const id = `task-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const accountId = normalizeText(req.authUser?.accountId);
  const payload = { ...(req.body || {}), id, userId: req.userId, accountId };

  const created = await runQuery(
    `INSERT INTO tasks (id, user_id, account_id, data)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, user_id, account_id, data, created_at, updated_at`,
    [id, req.userId, accountId, JSON.stringify(payload)]
  );

  res.status(201).json({ item: buildTaskRecord(created.rows[0]) });
});

router.post('/:id/complete', async (req, res) => {
  const taskId = normalizeText(req.params?.id);
  if (!taskId) {
    return res.status(400).json({ message: 'id da tarefa e obrigatorio.' });
  }

  const result = await withTransaction(async (client) => {
    const found = await client.query(
      `SELECT id, user_id, account_id, data, created_at, updated_at
       FROM tasks
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [taskId, req.userId]
    );

    const existing = found.rows[0];
    if (!existing) return null;

    const currentStatus = normalizeText(existing.data?.status).toLowerCase();
    const alreadyCompleted = currentStatus === 'concluida'
      || currentStatus === 'concluída'
      || currentStatus === 'concluido'
      || currentStatus === 'completed'
      || currentStatus === 'done';

    const sessionPayload = req.body?.session && typeof req.body.session === 'object' ? req.body.session : null;
    const sessionIdempotencyKey = normalizeText(sessionPayload?.idempotencyKey);
    let recordedSession = null;
    let alreadyRecorded = false;

    if (sessionPayload && sessionIdempotencyKey) {
      const priorSession = await client.query(
        `SELECT id, task_id, data, created_at
         FROM focus_sessions
         WHERE task_id = $1 AND user_id = $2 AND data->>'idempotencyKey' = $3
         LIMIT 1`,
        [taskId, req.userId, sessionIdempotencyKey]
      );
      if (priorSession.rows[0]) {
        const row = priorSession.rows[0];
        recordedSession = { ...(row.data || {}), id: row.id, taskId: row.task_id, created: row.created_at };
        alreadyRecorded = true;
      }
    }

    if (alreadyCompleted) {
      return { item: buildTaskRecord(existing), alreadyCompleted: true, session: recordedSession, alreadyRecorded };
    }

    if (sessionPayload && sessionIdempotencyKey && !recordedSession) {
      const sessionId = `focus-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const sessionData = { ...sessionPayload, taskId, id: sessionId, idempotencyKey: sessionIdempotencyKey };
      const insertedSession = await client.query(
        `INSERT INTO focus_sessions (id, task_id, user_id, account_id, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT DO NOTHING
         RETURNING id, task_id, data, created_at`,
        [sessionId, taskId, req.userId, normalizeText(sessionPayload.accountId), JSON.stringify(sessionData)]
      );
      let row = insertedSession.rows[0];
      if (!row) {
        const concurrentSession = await client.query(
          `SELECT id, task_id, data, created_at
           FROM focus_sessions
           WHERE task_id = $1 AND user_id = $2 AND data->>'idempotencyKey' = $3
           LIMIT 1`,
          [taskId, req.userId, sessionIdempotencyKey]
        );
        row = concurrentSession.rows[0];
        alreadyRecorded = Boolean(row);
      }
      if (!row) throw new Error('Nao foi possivel registrar a sessao da conclusao.');
      recordedSession = { ...(row.data || {}), id: row.id, taskId: row.task_id, created: row.created_at };
    }

    const completedAt = normalizeText(req.body?.completedAt) || new Date().toISOString();
    const mergedData = {
      ...(existing.data || {}),
      status: 'concluida',
      completedAt,
      lastActiveSubtaskId: '',
      id: existing.id,
    };

    const updated = await client.query(
      `UPDATE tasks
       SET data = $1::jsonb,
           updated_at = now()
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, account_id, data, created_at, updated_at`,
      [JSON.stringify(mergedData), taskId, req.userId]
    );

    return {
      item: buildTaskRecord(updated.rows[0]),
      alreadyCompleted: false,
      session: recordedSession,
      alreadyRecorded,
    };
  });

  if (!result) {
    return res.status(404).json({ message: 'Tarefa nao encontrada.' });
  }

  return res.json(result);
});

router.patch('/:id', async (req, res) => {
  const taskId = normalizeText(req.params?.id);
  if (!taskId) {
    return res.status(400).json({ message: 'id da tarefa e obrigatorio.' });
  }

  const found = await runQuery(
    `SELECT id, user_id, account_id, data, created_at, updated_at
     FROM tasks
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [taskId, req.userId]
  );

  const existing = found.rows[0];
  if (!existing) {
    return res.status(404).json({ message: 'Tarefa nao encontrada.' });
  }

  const mergedData = {
    ...(existing.data || {}),
    ...(req.body || {}),
    id: existing.id,
    userId: req.userId,
    accountId: normalizeText(req.authUser?.accountId),
  };

  const nextAccountId = normalizeText(req.authUser?.accountId);

  const updated = await runQuery(
    `UPDATE tasks
     SET account_id = $1,
         data = $2::jsonb,
         updated_at = now()
     WHERE id = $3 AND user_id = $4
     RETURNING id, user_id, account_id, data, created_at, updated_at`,
    [nextAccountId, JSON.stringify(mergedData), taskId, req.userId]
  );

  res.json({ item: buildTaskRecord(updated.rows[0]) });
});

router.delete('/:id', async (req, res) => {
  const taskId = normalizeText(req.params?.id);
  if (!taskId) {
    return res.status(400).json({ message: 'id da tarefa e obrigatorio.' });
  }

  const deleted = await runQuery(
    'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
    [taskId, req.userId]
  );

  if (deleted.rows.length === 0) {
    return res.status(404).json({ message: 'Tarefa nao encontrada.' });
  }

  return res.status(204).send();
});

router.get('/:taskId/notes', async (req, res) => {
  const taskId = normalizeText(req.params?.taskId);
  const task = await runQuery('SELECT id FROM tasks WHERE id = $1 AND user_id = $2 LIMIT 1', [taskId, req.userId]);
  if (!task.rows[0]) {
    return res.status(404).json({ message: 'Tarefa nao encontrada.' });
  }
  const notes = await runQuery(
    `SELECT id, task_id, content, created_at
     FROM task_notes AS note
     WHERE note.task_id = $1 AND note.user_id = $2
       AND EXISTS (
         SELECT 1 FROM tasks
         WHERE tasks.id = note.task_id AND tasks.user_id = note.user_id
       )
     ORDER BY created_at DESC`,
    [taskId, req.userId]
  );

  res.json({
    items: notes.rows.map((row) => ({
      id: row.id,
      taskId: row.task_id,
      content: row.content,
      created: row.created_at,
    })),
  });
});

router.post('/:taskId/notes', async (req, res) => {
  const taskId = normalizeText(req.params?.taskId);
  const content = normalizeText(req.body?.content);
  const accountId = normalizeText(req.authUser?.accountId);

  if (!taskId || !content) {
    return res.status(400).json({ message: 'taskId e content sao obrigatorios.' });
  }

  const id = `note-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const created = await runQuery(
    `INSERT INTO task_notes (id, task_id, user_id, account_id, content)
     SELECT $1, tasks.id, $3, $4, $5
     FROM tasks
     WHERE tasks.id = $2 AND tasks.user_id = $3
     RETURNING id, task_id, content, created_at`,
    [id, taskId, req.userId, accountId, content]
  );

  const row = created.rows[0];
  if (!row) {
    return res.status(404).json({ message: 'Tarefa nao encontrada.' });
  }
  res.status(201).json({
    item: {
      id: row.id,
      taskId: row.task_id,
      content: row.content,
      created: row.created_at,
    },
  });
});

router.get('/:taskId/focus-sessions', async (req, res) => {
  const taskId = normalizeText(req.params?.taskId);
  const task = await runQuery('SELECT id FROM tasks WHERE id = $1 AND user_id = $2 LIMIT 1', [taskId, req.userId]);
  if (!task.rows[0]) {
    return res.status(404).json({ message: 'Tarefa nao encontrada.' });
  }
  const sessions = await runQuery(
    `SELECT id, task_id, data, created_at
     FROM focus_sessions AS session
     WHERE session.task_id = $1 AND session.user_id = $2
       AND EXISTS (
         SELECT 1 FROM tasks
         WHERE tasks.id = session.task_id AND tasks.user_id = session.user_id
       )
     ORDER BY created_at DESC`,
    [taskId, req.userId]
  );

  res.json({
    items: sessions.rows.map((row) => ({
      ...(row.data || {}),
      id: row.id,
      taskId: row.task_id,
      created: row.created_at,
    })),
  });
});

router.post('/:taskId/focus-sessions', async (req, res) => {
  const taskId = normalizeText(req.params?.taskId);
  const accountId = normalizeText(req.authUser?.accountId);
  const idempotencyKey = normalizeText(req.body?.idempotencyKey);
  const id = `focus-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const data = { ...(req.body || {}), taskId, id, ...(idempotencyKey ? { idempotencyKey } : {}) };

  if (idempotencyKey) {
    const existing = await runQuery(
      `SELECT id, task_id, data, created_at
       FROM focus_sessions
       WHERE task_id = $1 AND user_id = $2 AND data->>'idempotencyKey' = $3
       LIMIT 1`,
      [taskId, req.userId, idempotencyKey]
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      return res.json({
        item: { ...(row.data || {}), id: row.id, taskId: row.task_id, created: row.created_at },
        alreadyRecorded: true,
      });
    }
  }

  const created = await runQuery(
    `INSERT INTO focus_sessions (id, task_id, user_id, account_id, data)
     SELECT $1, tasks.id, $3, $4, $5::jsonb
     FROM tasks
     WHERE tasks.id = $2 AND tasks.user_id = $3
     ON CONFLICT DO NOTHING
     RETURNING id, task_id, data, created_at`,
    [id, taskId, req.userId, accountId, JSON.stringify(data)]
  );

  let row = created.rows[0];
  if (!row && idempotencyKey) {
    const existing = await runQuery(
      `SELECT id, task_id, data, created_at
       FROM focus_sessions
       WHERE task_id = $1 AND user_id = $2 AND data->>'idempotencyKey' = $3
       LIMIT 1`,
      [taskId, req.userId, idempotencyKey]
    );
    row = existing.rows[0];
  }

  if (!row) {
    const task = await runQuery(
      'SELECT id FROM tasks WHERE id = $1 AND user_id = $2 LIMIT 1',
      [taskId, req.userId]
    );
    if (!task.rows[0]) {
      return res.status(404).json({ message: 'Tarefa nao encontrada.' });
    }
    return res.status(409).json({ message: 'A sessao ja foi registrada.' });
  }

  res.status(201).json({
    item: {
      ...(row.data || {}),
      id: row.id,
      taskId: row.task_id,
      created: row.created_at,
    },
  });
});

export default router;
