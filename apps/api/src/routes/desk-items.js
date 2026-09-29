import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { runQuery } from '../db/postgres.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const ITEM_TYPES = new Set(['note', 'project', 'shortcut']);
const NOTE_COLORS = new Set(['yellow', 'lilac', 'pink', 'green', 'blue', 'neutral', 'peach']);
const FOLDER_ICON_TONES = new Set(['none', 'sky', 'sage', 'sand', 'stone']);

function text(value, maxLength = 5000) {
  return String(value || '').trim().slice(0, maxLength);
}

function coordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(10000, Math.round(number))) : 0;
}

function safeExternalUrl(value) {
  try {
    const parsed = new URL(text(value, 2048));
    return parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function mapItem(row) {
  return {
    id: row.id,
    type: row.item_type,
    ...(row.data || {}),
    revision: Number(row.revision),
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    projectName: row.project_name || row.data?.projectName || '',
    projectAvailable: row.item_type !== 'project' || Boolean(row.project_name),
    taskAvailable: !row.data?.taskId || Boolean(row.task_id),
  };
}

async function validateData(userId, type, input = {}, current = {}) {
  const data = {
    ...current,
    x: coordinate(input.x ?? current.x),
    y: coordinate(input.y ?? current.y),
    order: coordinate(input.order ?? current.order),
  };

  if (type === 'note') {
    data.title = String(input.title ?? current.title ?? '').slice(0, 160);
    data.content = String(input.content ?? current.content ?? '').slice(0, 20000);
    data.color = NOTE_COLORS.has(input.color) ? input.color : (current.color || 'yellow');
    data.collapsed = input.collapsed === undefined ? Boolean(current.collapsed) : Boolean(input.collapsed);
    const taskId = text(input.taskId ?? current.taskId, 200);
    if (taskId) {
      const task = await runQuery('SELECT id FROM tasks WHERE id = $1 AND user_id = $2 LIMIT 1', [taskId, userId]);
      if (!task.rows[0]) throw Object.assign(new Error('Tarefa vinculada nao encontrada.'), { status: 404 });
    }
    data.taskId = taskId;
    const rawFormat = text(input.contentFormat ?? current.contentFormat, 20).toLowerCase();
    data.contentFormat = rawFormat === 'richtext' ? 'richtext' : 'plain';

    const hasProjectField = Object.prototype.hasOwnProperty.call(input, 'projectId')
      || Object.prototype.hasOwnProperty.call(input, 'projectName')
      || Object.prototype.hasOwnProperty.call(input, 'project');
    if (hasProjectField) {
      const projectIdRaw = text(input.projectId, 40);
      const projectNameRaw = text(input.projectName || input.project, 180);

      if (!projectIdRaw && !projectNameRaw) {
        data.projectId = '';
        data.projectName = '';
      } else if (projectIdRaw) {
        const projectId = Number(projectIdRaw);
        if (!Number.isInteger(projectId) || projectId < 1) {
          throw Object.assign(new Error('Projeto invalido.'), { status: 400 });
        }
        const project = await runQuery('SELECT id, name FROM project_profiles WHERE id = $1 AND user_id = $2 LIMIT 1', [projectId, userId]);
        if (!project.rows[0]) throw Object.assign(new Error('Projeto nao encontrado.'), { status: 404 });
        data.projectId = projectId;
        data.projectName = project.rows[0].name;
      } else {
        const project = await runQuery('SELECT id, name FROM project_profiles WHERE name = $1 AND user_id = $2 LIMIT 1', [projectNameRaw, userId]);
        if (!project.rows[0]) throw Object.assign(new Error('Projeto nao encontrado.'), { status: 404 });
        data.projectId = Number(project.rows[0].id);
        data.projectName = project.rows[0].name;
      }
    }
  }

  if (type === 'project') {
    const projectId = Number(input.projectId ?? current.projectId);
    if (!Number.isInteger(projectId) || projectId < 1) {
      throw Object.assign(new Error('Projeto invalido.'), { status: 400 });
    }
    const project = await runQuery('SELECT id, name FROM project_profiles WHERE id = $1 AND user_id = $2 LIMIT 1', [projectId, userId]);
    if (!project.rows[0]) throw Object.assign(new Error('Projeto nao encontrado.'), { status: 404 });
    data.projectId = projectId;
    data.projectName = project.rows[0].name;
    data.label = text(input.label ?? current.label ?? project.rows[0].name, 120);
    const iconTone = text(input.iconTone ?? current.iconTone, 40);
    data.iconTone = FOLDER_ICON_TONES.has(iconTone) ? iconTone : 'none';
  }

  if (type === 'shortcut') {
    data.label = text(input.label ?? current.label, 120);
    data.url = safeExternalUrl(input.url ?? current.url);
    const shortcutKind = text(input.shortcutKind ?? current.shortcutKind, 20);
    data.shortcutKind = shortcutKind === 'file' ? 'file' : 'link';
    const hasProjectField = Object.prototype.hasOwnProperty.call(input, 'projectId')
      || Object.prototype.hasOwnProperty.call(input, 'projectName')
      || Object.prototype.hasOwnProperty.call(input, 'project');
    if (hasProjectField) {
      const projectIdRaw = text(input.projectId, 40);
      const projectNameRaw = text(input.projectName || input.project, 180);
      if (!projectIdRaw && !projectNameRaw) {
        data.projectId = '';
        data.projectName = '';
      } else if (projectIdRaw) {
        const projectId = Number(projectIdRaw);
        if (!Number.isInteger(projectId) || projectId < 1) {
          throw Object.assign(new Error('Projeto invalido.'), { status: 400 });
        }
        const project = await runQuery('SELECT id, name FROM project_profiles WHERE id = $1 AND user_id = $2 LIMIT 1', [projectId, userId]);
        if (!project.rows[0]) throw Object.assign(new Error('Projeto nao encontrado.'), { status: 404 });
        data.projectId = projectId;
        data.projectName = project.rows[0].name;
      } else {
        const project = await runQuery('SELECT id, name FROM project_profiles WHERE name = $1 AND user_id = $2 LIMIT 1', [projectNameRaw, userId]);
        if (!project.rows[0]) throw Object.assign(new Error('Projeto nao encontrado.'), { status: 404 });
        data.projectId = Number(project.rows[0].id);
        data.projectName = project.rows[0].name;
      }
    }
    if (!data.label || !data.url) {
      throw Object.assign(new Error('Informe um nome e um endereco HTTPS valido.'), { status: 400 });
    }
  }

  return data;
}

router.use(requireAuth);

router.get('/', async (req, res) => {
  const result = await runQuery(
    `SELECT item.*, project.name AS project_name, task.id AS task_id
     FROM desk_items AS item
     LEFT JOIN project_profiles AS project
       ON item.item_type = 'project'
      AND project.id = CASE WHEN item.data->>'projectId' ~ '^[0-9]+$' THEN (item.data->>'projectId')::bigint END
      AND project.user_id = item.user_id
     LEFT JOIN tasks AS task
       ON task.id = item.data->>'taskId' AND task.user_id = item.user_id
    WHERE item.user_id = $1 AND item.deleted_at IS NULL AND item.archived_at IS NULL
     ORDER BY COALESCE((item.data->>'order')::integer, 0), item.created_at`,
    [req.userId]
  );
  res.json({ items: result.rows.map(mapItem) });
});

router.get('/archived', async (req, res) => {
  const result = await runQuery(
    `SELECT item.*, task.id AS task_id
     FROM desk_items AS item
     LEFT JOIN tasks AS task
       ON task.id = item.data->>'taskId' AND task.user_id = item.user_id
     WHERE item.user_id = $1 AND item.item_type = 'note'
       AND item.archived_at IS NOT NULL AND item.deleted_at IS NULL
     ORDER BY item.archived_at DESC`,
    [req.userId]
  );
  res.json({ items: result.rows.map(mapItem) });
});

router.post('/', async (req, res) => {
  const type = text(req.body?.type, 20);
  if (!ITEM_TYPES.has(type)) return res.status(400).json({ message: 'Tipo de item invalido.' });

  try {
    const data = await validateData(req.userId, type, req.body);
    const id = `desk-${randomUUID()}`;
    const created = await runQuery(
      `INSERT INTO desk_items (id, user_id, item_type, data)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING *`,
      [id, req.userId, type, JSON.stringify(data)]
    );
    res.status(201).json({ item: mapItem(created.rows[0]) });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Nao foi possivel criar o item.' });
  }
});

router.patch('/:id', async (req, res) => {
  const id = text(req.params.id, 200);
  const revision = Number(req.body?.revision);
  const found = await runQuery(
    'SELECT * FROM desk_items WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL LIMIT 1',
    [id, req.userId]
  );
  if (!found.rows[0]) return res.status(404).json({ message: 'Item nao encontrado.' });
  if (!Number.isInteger(revision) || revision !== Number(found.rows[0].revision)) {
    return res.status(409).json({ message: 'Este item possui uma alteracao mais recente.' });
  }

  try {
    const data = await validateData(req.userId, found.rows[0].item_type, req.body, found.rows[0].data);
    const updated = await runQuery(
      `UPDATE desk_items
       SET data = $1::jsonb, revision = revision + 1, updated_at = now()
       WHERE id = $2 AND user_id = $3 AND revision = $4 AND deleted_at IS NULL
       RETURNING *`,
      [JSON.stringify(data), id, req.userId, revision]
    );
    if (!updated.rows[0]) return res.status(409).json({ message: 'Este item possui uma alteracao mais recente.' });
    res.json({ item: mapItem(updated.rows[0]) });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message || 'Nao foi possivel salvar o item.' });
  }
});

router.delete('/:id', async (req, res) => {
  const deleted = await runQuery(
    `UPDATE desk_items SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING *`,
    [text(req.params.id, 200), req.userId]
  );
  if (!deleted.rows[0]) return res.status(404).json({ message: 'Item nao encontrado.' });
  res.json({ item: mapItem(deleted.rows[0]) });
});

router.post('/:id/restore', async (req, res) => {
  const restored = await runQuery(
    `UPDATE desk_items SET deleted_at = NULL, revision = revision + 1, updated_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL RETURNING *`,
    [text(req.params.id, 200), req.userId]
  );
  if (!restored.rows[0]) return res.status(404).json({ message: 'Item nao encontrado.' });
  res.json({ item: mapItem(restored.rows[0]) });
});

router.post('/:id/archive', async (req, res) => {
  const archived = await runQuery(
    `UPDATE desk_items SET archived_at = now(), revision = revision + 1, updated_at = now()
     WHERE id = $1 AND user_id = $2 AND item_type = 'note'
       AND archived_at IS NULL AND deleted_at IS NULL RETURNING *`,
    [text(req.params.id, 200), req.userId]
  );
  if (!archived.rows[0]) return res.status(404).json({ message: 'Nota nao encontrada.' });
  res.json({ item: mapItem(archived.rows[0]) });
});

router.post('/:id/unarchive', async (req, res) => {
  const restored = await runQuery(
    `UPDATE desk_items SET archived_at = NULL, revision = revision + 1, updated_at = now()
     WHERE id = $1 AND user_id = $2 AND item_type = 'note'
       AND archived_at IS NOT NULL AND deleted_at IS NULL RETURNING *`,
    [text(req.params.id, 200), req.userId]
  );
  if (!restored.rows[0]) return res.status(404).json({ message: 'Nota arquivada nao encontrada.' });
  res.json({ item: mapItem(restored.rows[0]) });
});

export default router;