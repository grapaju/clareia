import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { runQuery } from '../db/postgres.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';

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

router.use(pocketbaseAuth);

router.get('/', async (req, res) => {
  const result = await runQuery(
    `SELECT id, user_id, account_id, data, created_at, updated_at
     FROM tasks
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [req.pocketbaseUserId]
  );

  res.json({ items: result.rows.map(buildTaskRecord) });
});

router.post('/', async (req, res) => {
  const id = `task-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const payload = { ...(req.body || {}), id };
  const accountId = normalizeText(payload.accountId);

  const created = await runQuery(
    `INSERT INTO tasks (id, user_id, account_id, data)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, user_id, account_id, data, created_at, updated_at`,
    [id, req.pocketbaseUserId, accountId, JSON.stringify(payload)]
  );

  res.status(201).json({ item: buildTaskRecord(created.rows[0]) });
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
    [taskId, req.pocketbaseUserId]
  );

  const existing = found.rows[0];
  if (!existing) {
    return res.status(404).json({ message: 'Tarefa nao encontrada.' });
  }

  const mergedData = {
    ...(existing.data || {}),
    ...(req.body || {}),
    id: existing.id,
  };

  const nextAccountId = normalizeText(mergedData.accountId || existing.account_id);

  const updated = await runQuery(
    `UPDATE tasks
     SET account_id = $1,
         data = $2::jsonb,
         updated_at = now()
     WHERE id = $3 AND user_id = $4
     RETURNING id, user_id, account_id, data, created_at, updated_at`,
    [nextAccountId, JSON.stringify(mergedData), taskId, req.pocketbaseUserId]
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
    [taskId, req.pocketbaseUserId]
  );

  if (deleted.rows.length === 0) {
    return res.status(404).json({ message: 'Tarefa nao encontrada.' });
  }

  return res.status(204).send();
});

router.get('/:taskId/notes', async (req, res) => {
  const taskId = normalizeText(req.params?.taskId);
  const notes = await runQuery(
    `SELECT id, task_id, content, created_at
     FROM task_notes
     WHERE task_id = $1 AND user_id = $2
     ORDER BY created_at DESC`,
    [taskId, req.pocketbaseUserId]
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
  const accountId = normalizeText(req.body?.accountId);

  if (!taskId || !content) {
    return res.status(400).json({ message: 'taskId e content sao obrigatorios.' });
  }

  const id = `note-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const created = await runQuery(
    `INSERT INTO task_notes (id, task_id, user_id, account_id, content)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, task_id, content, created_at`,
    [id, taskId, req.pocketbaseUserId, accountId, content]
  );

  const row = created.rows[0];
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
  const sessions = await runQuery(
    `SELECT id, task_id, data, created_at
     FROM focus_sessions
     WHERE task_id = $1 AND user_id = $2
     ORDER BY created_at DESC`,
    [taskId, req.pocketbaseUserId]
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
  const accountId = normalizeText(req.body?.accountId);
  const id = `focus-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const data = { ...(req.body || {}), taskId, id };

  const created = await runQuery(
    `INSERT INTO focus_sessions (id, task_id, user_id, account_id, data)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, task_id, data, created_at`,
    [id, taskId, req.pocketbaseUserId, accountId, JSON.stringify(data)]
  );

  const row = created.rows[0];
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
