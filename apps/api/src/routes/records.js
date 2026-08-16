import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { runQuery } from '../db/postgres.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';

const router = Router();

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeCollection(value) {
  return normalizeText(value).replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
}

function mapRecord(row) {
  return {
    ...(row.data || {}),
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id || row.data?.accountId || '',
    created: row.created_at,
    updated: row.updated_at,
  };
}

function parseFilterExpression(filter) {
  const normalized = normalizeText(filter);
  if (!normalized) return [];

  const clauses = normalized
    .split(/&&/)
    .map((part) => part.trim())
    .filter(Boolean);

  const parsed = [];
  clauses.forEach((clause) => {
    const matched = clause.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([\s\S]*)"$/)
      || clause.match(/^([a-zA-Z0-9_-]+)\s*=\s*'([\s\S]*)'$/);

    if (!matched) return;

    parsed.push({
      field: matched[1],
      value: matched[2],
    });
  });

  return parsed;
}

function appendSort(orderBy, params, sort) {
  const normalized = normalizeText(sort);
  if (!normalized) {
    orderBy.push('created_at DESC');
    return;
  }

  const parts = normalized.split(',').map((item) => item.trim()).filter(Boolean);
  parts.forEach((token) => {
    const descending = token.startsWith('-');
    const field = token.replace(/^[-+]/, '');
    const direction = descending ? 'DESC' : 'ASC';

    if (field === 'created') {
      orderBy.push(`created_at ${direction}`);
      return;
    }
    if (field === 'updated') {
      orderBy.push(`updated_at ${direction}`);
      return;
    }
    if (field === 'id') {
      orderBy.push(`id ${direction}`);
      return;
    }

    params.push(field);
    const idx = params.length;
    orderBy.push(`data->>$${idx} ${direction}`);
  });

  if (orderBy.length === 0) {
    orderBy.push('created_at DESC');
  }
}

router.use(pocketbaseAuth);

router.get('/:collection', async (req, res) => {
  const collection = normalizeCollection(req.params.collection);
  if (!collection) {
    return res.status(400).json({ message: 'collection invalida.' });
  }

  const params = [collection, req.pocketbaseUserId];
  const where = ['collection_name = $1', 'user_id = $2'];

  const filters = parseFilterExpression(req.query.filter);
  filters.forEach((entry) => {
    if (entry.field === 'id') {
      params.push(entry.value);
      where.push(`id = $${params.length}`);
      return;
    }

    if (entry.field === 'userId') {
      params.push(entry.value);
      where.push(`user_id::text = $${params.length}`);
      return;
    }

    if (entry.field === 'accountId') {
      params.push(entry.value);
      where.push(`account_id = $${params.length}`);
      return;
    }

    params.push(entry.field, entry.value);
    const keyIdx = params.length - 1;
    const valIdx = params.length;
    where.push(`data->>$${keyIdx} = $${valIdx}`);
  });

  const orderBy = [];
  appendSort(orderBy, params, req.query.sort);

  const sql = `
    SELECT id, user_id, account_id, data, created_at, updated_at
    FROM app_records
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy.join(', ')}
  `;

  const result = await runQuery(sql, params);
  res.json({ items: result.rows.map(mapRecord) });
});

router.post('/:collection', async (req, res) => {
  const collection = normalizeCollection(req.params.collection);
  if (!collection) {
    return res.status(400).json({ message: 'collection invalida.' });
  }

  const payload = { ...(req.body || {}) };
  const id = normalizeText(payload.id) || `rec-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const accountId = normalizeText(payload.accountId);
  payload.id = id;

  const created = await runQuery(
    `INSERT INTO app_records (id, collection_name, user_id, account_id, data)
     VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING id, user_id, account_id, data, created_at, updated_at`,
    [id, collection, req.pocketbaseUserId, accountId, JSON.stringify(payload)]
  );

  res.status(201).json({ item: mapRecord(created.rows[0]) });
});

router.patch('/:collection/:id', async (req, res) => {
  const collection = normalizeCollection(req.params.collection);
  const id = normalizeText(req.params.id);
  if (!collection || !id) {
    return res.status(400).json({ message: 'collection e id sao obrigatorios.' });
  }

  const found = await runQuery(
    `SELECT id, user_id, account_id, data, created_at, updated_at
     FROM app_records
     WHERE id = $1 AND collection_name = $2 AND user_id = $3
     LIMIT 1`,
    [id, collection, req.pocketbaseUserId]
  );

  const existing = found.rows[0];
  if (!existing) {
    return res.status(404).json({ message: 'Registro nao encontrado.' });
  }

  const merged = {
    ...(existing.data || {}),
    ...(req.body || {}),
    id,
  };

  const nextAccountId = normalizeText(merged.accountId || existing.account_id);

  const updated = await runQuery(
    `UPDATE app_records
     SET account_id = $1,
         data = $2::jsonb,
         updated_at = now()
     WHERE id = $3 AND collection_name = $4 AND user_id = $5
     RETURNING id, user_id, account_id, data, created_at, updated_at`,
    [nextAccountId, JSON.stringify(merged), id, collection, req.pocketbaseUserId]
  );

  res.json({ item: mapRecord(updated.rows[0]) });
});

router.delete('/:collection/:id', async (req, res) => {
  const collection = normalizeCollection(req.params.collection);
  const id = normalizeText(req.params.id);
  if (!collection || !id) {
    return res.status(400).json({ message: 'collection e id sao obrigatorios.' });
  }

  const deleted = await runQuery(
    'DELETE FROM app_records WHERE id = $1 AND collection_name = $2 AND user_id = $3 RETURNING id',
    [id, collection, req.pocketbaseUserId]
  );

  if (deleted.rows.length === 0) {
    return res.status(404).json({ message: 'Registro nao encontrado.' });
  }

  return res.status(204).send();
});

export default router;
