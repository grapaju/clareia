import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { runQuery, withTransaction } from '../db/postgres.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const OPERATIONAL_TASK_SQL = `
  COALESCE(data->>'deletedAt', '') = ''
  AND COALESCE(data->>'deleted_at', '') = ''
  AND lower(COALESCE(data->>'isDeleted', 'false')) NOT IN ('true', '1', 'yes')
  AND lower(COALESCE(data->>'status', '')) NOT IN ('excluida', 'excluída', 'deleted')
`;

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeTaskDates(data = {}, changedData = data) {
  const hasChanged = (field) => Object.prototype.hasOwnProperty.call(changedData || {}, field);
  const dueDate = hasChanged('dueDate')
    ? changedData.dueDate
    : hasChanged('dataLimite') ? changedData.dataLimite : data.dueDate ?? data.dataLimite ?? '';
  const scheduledDate = hasChanged('scheduledDate')
    ? changedData.scheduledDate
    : hasChanged('dataSugeridaExecucao') ? changedData.dataSugeridaExecucao : data.scheduledDate ?? data.dataSugeridaExecucao ?? '';
  return { ...data, dueDate, scheduledDate };
}

function buildTaskRecord(row) {
  const data = normalizeTaskDates(row.data || {});
  return {
    ...data,
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id || data.accountId || '',
    created: row.created_at,
    updated: row.updated_at,
  };
}

function buildActiveTaskSession(row) {
  if (!row) return null;
  const accumulatedSeconds = Number(row.accumulated_seconds || 0);
  const runningSeconds = row.state === 'running' && row.running_since
    ? Math.max(0, Math.floor((new Date(row.server_now).getTime() - new Date(row.running_since).getTime()) / 1000))
    : 0;
  const blockRunningSeconds = row.state === 'running' && row.block_running_since
    ? Math.max(0, Math.floor((new Date(row.server_now).getTime() - new Date(row.block_running_since).getTime()) / 1000))
    : 0;
  const blockElapsedSeconds = Number(row.block_accumulated_seconds || 0) + blockRunningSeconds;
  return {
    id: row.session_id,
    taskId: row.task_id,
    taskTitle: row.task_title || '',
    state: row.state,
    accumulatedSeconds,
    elapsedSeconds: accumulatedSeconds + runningSeconds,
    runningSince: row.running_since,
    blockStartedAt: row.block_started_at,
    blockElapsedSeconds,
    blockRemainingSeconds: Math.max(0, Number(row.block_duration_seconds || 1200) - blockElapsedSeconds),
    blockDurationSeconds: Number(row.block_duration_seconds || 1200),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    serverNow: row.server_now,
  };
}

async function readActiveTaskSession(client, userId) {
  const result = await client.query(
    `SELECT session.session_id, session.task_id, session.state,
            session.accumulated_seconds, session.running_since,
            session.block_started_at, session.block_accumulated_seconds,
            session.block_running_since, session.block_duration_seconds,
            session.created_at, session.updated_at, now() AS server_now,
            COALESCE(task.data->>'title', '') AS task_title
     FROM active_task_sessions AS session
     LEFT JOIN tasks AS task ON task.id = session.task_id AND task.user_id = session.user_id
     WHERE session.user_id = $1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] || null;
}

router.use(requireAuth);

router.get('/', async (req, res) => {
  const result = await runQuery(
    `SELECT id, user_id, account_id, data, created_at, updated_at
     FROM tasks
     WHERE user_id = $1
       AND ${OPERATIONAL_TASK_SQL}
     ORDER BY created_at DESC`,
    [req.userId]
  );

  res.json({ items: result.rows.map(buildTaskRecord) });
});

router.post('/', async (req, res) => {
  const sourceDeskNoteId = normalizeText(req.body?.sourceDeskNoteId);
  if (sourceDeskNoteId) {
    const existing = await runQuery(
      `SELECT id, user_id, account_id, data, created_at, updated_at
       FROM tasks
       WHERE user_id = $1 AND data->>'sourceDeskNoteId' = $2
       LIMIT 1`,
      [req.userId, sourceDeskNoteId]
    );
    if (existing.rows[0]) return res.json({ item: buildTaskRecord(existing.rows[0]) });
  }

  const id = `task-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const accountId = normalizeText(req.authUser?.accountId);
  const payload = normalizeTaskDates({ ...(req.body || {}), id, userId: req.userId, accountId });

  const created = await runQuery(
    `INSERT INTO tasks (id, user_id, account_id, data)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT DO NOTHING
     RETURNING id, user_id, account_id, data, created_at, updated_at`,
    [id, req.userId, accountId, JSON.stringify(payload)]
  );

  if (!created.rows[0] && sourceDeskNoteId) {
    const concurrent = await runQuery(
      `SELECT id, user_id, account_id, data, created_at, updated_at
       FROM tasks WHERE user_id = $1 AND data->>'sourceDeskNoteId' = $2 LIMIT 1`,
      [req.userId, sourceDeskNoteId]
    );
    if (concurrent.rows[0]) return res.json({ item: buildTaskRecord(concurrent.rows[0]) });
  }

  res.status(201).json({ item: buildTaskRecord(created.rows[0]) });
});

router.get('/session/current', async (req, res) => {
  const row = await readActiveTaskSession({ query: runQuery }, req.userId);
  res.json({ session: buildActiveTaskSession(row) });
});

router.post('/session/start', async (req, res) => {
  const taskId = normalizeText(req.body?.taskId);
  const confirmSwitch = req.body?.confirmSwitch === true;
  const requestedBlockSeconds = Number(req.body?.blockDurationSeconds || 1200);
  const blockDurationSeconds = Number.isFinite(requestedBlockSeconds)
    ? Math.min(14400, Math.max(60, Math.round(requestedBlockSeconds)))
    : 1200;

  if (!taskId) return res.status(400).json({ message: 'taskId e obrigatorio.' });

  const result = await withTransaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
    const task = await client.query(
      `SELECT id FROM tasks WHERE id = $1 AND user_id = $2 AND ${OPERATIONAL_TASK_SQL} LIMIT 1`,
      [taskId, req.userId]
    );
    if (!task.rows[0]) return { notFound: true };

    const existing = await readActiveTaskSession(client, req.userId);
    if (existing?.task_id === taskId) return { session: buildActiveTaskSession(existing) };
    if (existing && !confirmSwitch) {
      return { conflict: true, session: buildActiveTaskSession(existing) };
    }

    let previousSession = null;
    if (existing) {
      previousSession = buildActiveTaskSession(existing);
      const historyId = `focus-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const historyData = {
        id: historyId,
        taskId: existing.task_id,
        idempotencyKey: existing.session_id,
        durationSeconds: previousSession.elapsedSeconds,
        endReason: 'Pausada ao iniciar outra tarefa',
      };
      await client.query(
        `INSERT INTO focus_sessions (id, task_id, user_id, account_id, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT DO NOTHING`,
        [historyId, existing.task_id, req.userId, normalizeText(req.authUser?.accountId), JSON.stringify(historyData)]
      );
      await client.query('DELETE FROM active_task_sessions WHERE user_id = $1', [req.userId]);
    }

    const sessionId = `task-session-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await client.query(
      `INSERT INTO active_task_sessions (
         user_id, session_id, task_id, account_id, state, accumulated_seconds,
         running_since, block_started_at, block_accumulated_seconds,
         block_running_since, block_duration_seconds
       ) VALUES ($1, $2, $3, $4, 'running', 0, now(), now(), 0, now(), $5)`,
      [req.userId, sessionId, taskId, normalizeText(req.authUser?.accountId), blockDurationSeconds]
    );
    return {
      session: buildActiveTaskSession(await readActiveTaskSession(client, req.userId)),
      previousSession,
    };
  });

  if (result.notFound) return res.status(404).json({ message: 'Tarefa nao encontrada.' });
  if (result.conflict) {
    return res.status(409).json({
      code: 'ACTIVE_TASK_SESSION_CONFLICT',
      message: 'Existe outra tarefa em andamento.',
      session: result.session,
    });
  }
  return res.status(201).json(result);
});

router.post('/session/pause', async (req, res) => {
  const result = await withTransaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
    const existing = await readActiveTaskSession(client, req.userId);
    if (!existing) return null;
    if (existing.state === 'paused') return buildActiveTaskSession(existing);

    await client.query(
      `UPDATE active_task_sessions
       SET accumulated_seconds = accumulated_seconds + GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - running_since))))::bigint,
           block_accumulated_seconds = block_accumulated_seconds + GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - block_running_since))))::bigint,
           state = 'paused', running_since = NULL, block_running_since = NULL, updated_at = now()
       WHERE user_id = $1`,
      [req.userId]
    );
    return buildActiveTaskSession(await readActiveTaskSession(client, req.userId));
  });
  res.json({ session: result });
});

router.post('/session/resume', async (req, res) => {
  const result = await withTransaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
    const existing = await readActiveTaskSession(client, req.userId);
    if (!existing) return null;
    if (existing.state === 'running') return buildActiveTaskSession(existing);

    await client.query(
      `UPDATE active_task_sessions
        SET state = 'running', running_since = now(), block_running_since = now(), updated_at = now()
       WHERE user_id = $1`,
      [req.userId]
    );
    return buildActiveTaskSession(await readActiveTaskSession(client, req.userId));
  });
  res.json({ session: result });
});

router.post('/session/next-block', async (req, res) => {
  const requestedBlockSeconds = Number(req.body?.blockDurationSeconds || 1200);
  const blockDurationSeconds = Number.isFinite(requestedBlockSeconds)
    ? Math.min(14400, Math.max(60, Math.round(requestedBlockSeconds)))
    : 1200;
  const result = await withTransaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
    const existing = await readActiveTaskSession(client, req.userId);
    if (!existing) return null;
    await client.query(
      `UPDATE active_task_sessions
         SET block_started_at = now(), block_accumulated_seconds = 0,
           block_running_since = CASE WHEN state = 'running' THEN now() ELSE NULL END,
           block_duration_seconds = $2, updated_at = now()
       WHERE user_id = $1`,
      [req.userId, blockDurationSeconds]
    );
    return buildActiveTaskSession(await readActiveTaskSession(client, req.userId));
  });
  res.json({ session: result });
});

router.post('/session/finish', async (req, res) => {
  const result = await withTransaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
    const existing = await readActiveTaskSession(client, req.userId);
    if (!existing) return null;
    const session = buildActiveTaskSession(existing);
    await client.query('DELETE FROM active_task_sessions WHERE user_id = $1', [req.userId]);
    return session;
  });
  res.json({ session: result });
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

    const activeSessionRow = await readActiveTaskSession(client, req.userId);
    const activeTaskSession = activeSessionRow?.task_id === taskId
      ? buildActiveTaskSession(activeSessionRow)
      : null;

    const currentStatus = normalizeText(existing.data?.status).toLowerCase();
    const alreadyCompleted = currentStatus === 'concluida'
      || currentStatus === 'concluída'
      || currentStatus === 'concluido'
      || currentStatus === 'completed'
      || currentStatus === 'done';

    const requestedSessionPayload = req.body?.session && typeof req.body.session === 'object' ? req.body.session : null;
    const sessionPayload = activeTaskSession ? {
      ...(requestedSessionPayload || {}),
      durationSeconds: activeTaskSession.elapsedSeconds,
      idempotencyKey: activeTaskSession.id,
      endReason: requestedSessionPayload?.endReason || 'Tarefa concluída',
    } : requestedSessionPayload;
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
      if (activeTaskSession) {
        await client.query(
          'DELETE FROM active_task_sessions WHERE user_id = $1 AND task_id = $2',
          [req.userId, taskId]
        );
      }
      return {
        item: buildTaskRecord(existing),
        alreadyCompleted: true,
        session: recordedSession,
        alreadyRecorded,
        taskSession: activeTaskSession,
      };
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

    if (activeTaskSession) {
      await client.query(
        'DELETE FROM active_task_sessions WHERE user_id = $1 AND task_id = $2',
        [req.userId, taskId]
      );
    }

    return {
      item: buildTaskRecord(updated.rows[0]),
      alreadyCompleted: false,
      session: recordedSession,
      alreadyRecorded,
      taskSession: activeTaskSession,
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

  const mergedData = normalizeTaskDates({
    ...(existing.data || {}),
    ...(req.body || {}),
    id: existing.id,
    userId: req.userId,
    accountId: normalizeText(req.authUser?.accountId),
  }, req.body || {});

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
