import { Router } from 'express';
import { withTransaction } from '../db/postgres.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function text(value) {
  return String(value || '').trim();
}

function normalizeProjectKey(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function mapTask(row) {
  return {
    ...(row.data || {}),
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id || row.data?.accountId || '',
    created: row.created_at,
    updated: row.updated_at,
  };
}

function findProject(projects, candidate) {
  const key = normalizeProjectKey(candidate);
  return projects.find((project) => normalizeProjectKey(project.name) === key) || null;
}

router.use(requireAuth);

router.get('/context', async (req, res) => {
  const result = await withTransaction(async (client) => {
    const [projects, aliases] = await Promise.all([
      client.query(
        `SELECT name, summary, project_type
         FROM project_profiles
         WHERE user_id = $1
         ORDER BY lower(name) ASC`,
        [req.userId]
      ),
      client.query(
        `SELECT alias, alias_normalized, project_name
         FROM project_aliases
         WHERE user_id = $1 AND account_id = $2
         ORDER BY updated_at DESC`,
        [req.userId, text(req.authUser?.accountId)]
      ),
    ]);

    return { projects: projects.rows, aliases: aliases.rows };
  });

  res.json({
    projects: result.projects.map((row) => ({
      name: row.name,
      summary: row.summary || '',
      projectType: row.project_type || 'Administrativo',
    })),
    aliases: result.aliases.map((row) => ({
      alias: row.alias,
      normalized: row.alias_normalized,
      projectName: row.project_name,
    })),
  });
});

router.post('/confirm', async (req, res) => {
  const planId = text(req.body?.planId);
  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
  const accountId = text(req.body?.accountId || req.authUser?.accountId);
  const origin = text(req.body?.origin) || 'plano-clareado';

  if (!planId || tasks.length === 0) {
    return res.status(400).json({ message: 'Plano e tarefas sao obrigatorios.' });
  }

  const result = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`plan:${req.userId}:${planId}`]);

    const planResult = await client.query(
      `SELECT id, data
       FROM app_records
       WHERE id = $1 AND collection_name = 'planosclareados' AND user_id = $2
       FOR UPDATE`,
      [planId, req.userId]
    );
    const planRecord = planResult.rows[0];
    if (!planRecord) {
      const error = new Error('Plano nao encontrado.');
      error.status = 404;
      throw error;
    }

    const existingTasks = await client.query(
      `SELECT id, user_id, account_id, data, created_at, updated_at
       FROM tasks
       WHERE user_id = $1 AND data->>'sourcePlanId' = $2
       ORDER BY created_at ASC`,
      [req.userId, planId]
    );

    if (existingTasks.rows.length > 0) {
      return { items: existingTasks.rows.map(mapTask), reused: true, projectsCreated: [] };
    }

    const projectRows = await client.query(
      `SELECT name, summary, project_type
       FROM project_profiles
       WHERE user_id = $1
       FOR UPDATE`,
      [req.userId]
    );
    const projects = projectRows.rows;
    const projectsCreated = [];

    const ensureProject = async (requestedName, projectStatus) => {
      const candidate = projectStatus === 'personal' ? 'Pessoal' : text(requestedName);
      if (!candidate || projectStatus === 'undecided') return '';

      const existing = findProject(projects, candidate);
      if (existing) return existing.name;

      if (projectStatus !== 'new' && projectStatus !== 'personal') return candidate;

      const projectType = projectStatus === 'personal' ? 'Pessoal' : 'Administrativo';
      const created = await client.query(
        `INSERT INTO project_profiles (user_id, name, summary, project_type)
         VALUES ($1, $2, $3, $4)
         RETURNING name, summary, project_type`,
        [
          req.userId,
          candidate,
          projectStatus === 'personal' ? 'Projeto pessoal padrao do Clareia.' : 'Criado junto com um plano confirmado.',
          projectType,
        ]
      );
      projects.push(created.rows[0]);
      projectsCreated.push(candidate);
      return candidate;
    };

    const createdTasks = [];
    for (let index = 0; index < tasks.length; index += 1) {
      const incoming = { ...(tasks[index] || {}) };
      const title = text(incoming.title);
      if (!title) continue;

      const projectStatus = text(incoming.projectStatus) || 'undecided';
      const project = await ensureProject(incoming.project, projectStatus);
      const sourceTaskId = text(incoming.id) || String(index + 1);
      const safeTaskKey = `${planId}-${sourceTaskId}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(-120);
      const id = `plan-task-${safeTaskKey}`;
      const payload = {
        ...incoming,
        id,
        project,
        projectStatus,
        accountId,
        source: origin,
        sourcePlanId: planId,
        sourceTaskId,
      };

      const inserted = await client.query(
        `INSERT INTO tasks (id, user_id, account_id, data)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (id) DO NOTHING
         RETURNING id, user_id, account_id, data, created_at, updated_at`,
        [id, req.userId, accountId, JSON.stringify(payload)]
      );

      if (inserted.rows[0]) createdTasks.push(mapTask(inserted.rows[0]));

      const alias = text(incoming.projectAlias || incoming.projectMention);
      if (alias && project) {
        await client.query(
          `INSERT INTO project_aliases (user_id, account_id, alias, alias_normalized, project_name)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, account_id, alias_normalized)
           DO UPDATE SET alias = EXCLUDED.alias, project_name = EXCLUDED.project_name, updated_at = now()`,
          [req.userId, accountId, alias, normalizeProjectKey(alias), project]
        );
      }
    }

    const currentPlan = planRecord.data?.planoGerado || {};
    const nextPlanData = {
      ...(planRecord.data || {}),
      planoGerado: {
        ...currentPlan,
        meta: {
          ...(currentPlan.meta || {}),
          status: 'created',
          reviewed: true,
          createdTasksCount: createdTasks.length,
          processedAt: new Date().toISOString(),
        },
      },
    };
    await client.query(
      `UPDATE app_records SET data = $1::jsonb, updated_at = now()
       WHERE id = $2 AND collection_name = 'planosclareados' AND user_id = $3`,
      [JSON.stringify(nextPlanData), planId, req.userId]
    );

    return { items: createdTasks, reused: false, projectsCreated };
  });

  res.status(result.reused ? 200 : 201).json(result);
});

export default router;