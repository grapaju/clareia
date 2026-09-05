import { Router } from 'express';
import { runQuery, withTransaction } from '../db/postgres.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function normalizeText(value) {
	return String(value || '').trim();
}

function normalizeProjectKey(value) {
	return normalizeText(value)
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');
}

function normalizeWorkDays(value) {
	if (!Array.isArray(value)) return [1, 2, 3, 4, 5];
	return [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
}

function validateTimezone(value) {
	const timezone = normalizeText(value);
	if (!timezone) return '';
	try {
		new Intl.DateTimeFormat('pt-BR', { timeZone: timezone }).format();
		return timezone;
	} catch {
		return null;
	}
}

async function findNormalizedDuplicate(userId, name, excludedName = '') {
	const result = await runQuery(
		'SELECT name FROM project_profiles WHERE user_id = $1',
		[userId]
	);
	const candidateKey = normalizeProjectKey(name);
	const excludedKey = normalizeProjectKey(excludedName);
	return result.rows.find((row) => {
		const rowKey = normalizeProjectKey(row.name);
		return rowKey === candidateKey && (!excludedKey || rowKey !== excludedKey);
	}) || null;
}

function mapProject(row) {
	return {
		name: row.name,
		summary: row.summary || '',
		projectType: row.project_type || 'Administrativo',
		professionalTrackingEnabled: Boolean(row.professional_tracking_enabled),
		weeklyTargetMinutes: Number(row.weekly_target_minutes || 2400),
		workDays: Array.isArray(row.work_days) ? row.work_days : [1, 2, 3, 4, 5],
		timezone: row.timezone || '',
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

router.use(requireAuth);

router.get('/', async (req, res) => {
	const result = await runQuery(
		`SELECT name, summary, project_type, professional_tracking_enabled,
		        weekly_target_minutes, work_days, timezone, created_at, updated_at
		 FROM project_profiles
		 WHERE user_id = $1
		 ORDER BY lower(name) ASC`,
		[req.userId]
	);

	res.json({ items: result.rows.map(mapProject) });
});

router.post('/', async (req, res) => {
	const name = normalizeText(req.body?.name);
	const summary = normalizeText(req.body?.summary);
	const projectType = normalizeText(req.body?.projectType) || 'Administrativo';
	const professionalTrackingEnabled = Boolean(req.body?.professionalTrackingEnabled);
	const weeklyTargetMinutes = Number(req.body?.weeklyTargetMinutes || 2400);
	const workDays = normalizeWorkDays(req.body?.workDays);
	const timezone = validateTimezone(req.body?.timezone);

	if (!name) {
		return res.status(400).json({ message: 'Nome do projeto e obrigatorio.' });
	}
	if (!Number.isInteger(weeklyTargetMinutes) || weeklyTargetMinutes < 1 || weeklyTargetMinutes > 10080) {
		return res.status(400).json({ message: 'Meta semanal invalida.' });
	}
	if (timezone === null) {
		return res.status(400).json({ message: 'Fuso horario invalido.' });
	}

	const duplicate = await findNormalizedDuplicate(req.userId, name);

	if (duplicate) {
		return res.status(409).json({ message: 'Ja existe um projeto com esse nome.' });
	}

	const created = await runQuery(
		`INSERT INTO project_profiles (
		   user_id, name, summary, project_type, professional_tracking_enabled,
		   weekly_target_minutes, work_days, timezone
		 )
		 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
		 RETURNING name, summary, project_type, professional_tracking_enabled,
		           weekly_target_minutes, work_days, timezone, created_at, updated_at`,
		[req.userId, name, summary, projectType, professionalTrackingEnabled,
		 weeklyTargetMinutes, JSON.stringify(workDays), timezone]
	);

	res.status(201).json({ item: mapProject(created.rows[0]) });
});

router.post('/merge', async (req, res) => {
	const source = normalizeText(req.body?.source);
	const target = normalizeText(req.body?.target);
	if (!source || !target || normalizeProjectKey(source) === normalizeProjectKey(target)) {
		return res.status(400).json({ message: 'Projetos de origem e destino diferentes sao obrigatorios.' });
	}

	const result = await withTransaction(async (client) => {
		await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`project-merge:${req.userId}`]);
		const targetProfile = await client.query(
			'SELECT name FROM project_profiles WHERE user_id = $1 AND lower(name) = lower($2) LIMIT 1',
			[req.userId, target]
		);
		const targetTask = targetProfile.rows[0] ? null : await client.query(
			`SELECT data->>'project' AS name FROM tasks
			 WHERE user_id = $1 AND lower(COALESCE(data->>'project', '')) = lower($2) LIMIT 1`,
			[req.userId, target]
		);
		const canonicalTarget = targetProfile.rows[0]?.name || targetTask?.rows[0]?.name;
		if (!canonicalTarget) {
			const error = new Error('Projeto de destino nao encontrado.');
			error.status = 404;
			throw error;
		}
		if (!targetProfile.rows[0]) {
			await client.query(
				`INSERT INTO project_profiles (user_id, name)
				 VALUES ($1, $2)
				 ON CONFLICT (user_id, name) DO NOTHING`,
				[req.userId, canonicalTarget]
			);
		}

		const tasks = await client.query(
			`UPDATE tasks
			 SET data = jsonb_set(data, '{project}', to_jsonb($1::text), true), updated_at = now()
			 WHERE user_id = $2 AND lower(COALESCE(data->>'project', '')) = lower($3)
			 RETURNING id`,
			[canonicalTarget, req.userId, source]
		);
		const sessions = await client.query(
			`UPDATE focus_sessions
			 SET data = jsonb_set(data, '{projectId}', to_jsonb($1::text), true)
			 WHERE user_id = $2 AND lower(COALESCE(data->>'projectId', '')) = lower($3)
			 RETURNING id`,
			[canonicalTarget, req.userId, source]
		);
		await client.query(
			`UPDATE professional_journeys SET project_name = $1, updated_at = now()
			 WHERE user_id = $2 AND lower(project_name) = lower($3)`,
			[canonicalTarget, req.userId, source]
		);
		await client.query(
			`UPDATE professional_activities SET project_name = $1, updated_at = now()
			 WHERE user_id = $2 AND lower(project_name) = lower($3)`,
			[canonicalTarget, req.userId, source]
		);
		const aliases = await client.query(
			`UPDATE project_aliases SET project_name = $1, updated_at = now()
			 WHERE user_id = $2 AND lower(project_name) = lower($3)
			 RETURNING alias`,
			[canonicalTarget, req.userId, source]
		);
		const records = await client.query(
			`UPDATE app_records
			 SET data = jsonb_set(
			   CASE
			     WHEN lower(COALESCE(data->>'project', '')) = lower($3)
			     THEN jsonb_set(data, '{project}', to_jsonb($1::text), true)
			     ELSE data
			   END,
			   '{projectId}',
			   CASE
			     WHEN lower(COALESCE(data->>'projectId', '')) = lower($3) THEN to_jsonb($1::text)
			     ELSE COALESCE(data->'projectId', 'null'::jsonb)
			   END,
			   true
			 ), updated_at = now()
			 WHERE user_id = $2
			   AND (
			     lower(COALESCE(data->>'project', '')) = lower($3)
			     OR lower(COALESCE(data->>'projectId', '')) = lower($3)
			   )
			 RETURNING id`,
			[canonicalTarget, req.userId, source]
		);
		await client.query(
			`DELETE FROM google_drive_project_folders AS source_folder
			 WHERE source_folder.user_id = $1
			   AND lower(source_folder.project_id) = lower($2)
			   AND EXISTS (
			     SELECT 1 FROM google_drive_project_folders AS target_folder
			     WHERE target_folder.user_id = source_folder.user_id
			       AND lower(target_folder.project_id) = lower($3)
			   )`,
			[req.userId, source, canonicalTarget]
		);
		await client.query(
			`UPDATE google_drive_project_folders
			 SET project_id = $1, project_name = $1, updated_at = now()
			 WHERE user_id = $2 AND lower(project_id) = lower($3)`,
			[canonicalTarget, req.userId, source]
		);

		await client.query(
			`DELETE FROM project_profiles
			 WHERE user_id = $1 AND lower(name) = lower($2)`,
			[req.userId, source]
		);

		return {
			target: canonicalTarget,
			tasksMoved: tasks.rowCount,
			sessionsMoved: sessions.rowCount,
			aliasesMoved: aliases.rowCount,
			recordsMoved: records.rowCount,
		};
	});

	return res.json(result);
});

router.patch('/:name', async (req, res) => {
	const currentName = normalizeText(req.params?.name);
	const nextName = normalizeText(req.body?.name) || currentName;
	const timezone = Object.hasOwn(req.body || {}, 'timezone') ? validateTimezone(req.body?.timezone) : undefined;
	const weeklyTargetMinutes = Object.hasOwn(req.body || {}, 'weeklyTargetMinutes')
		? Number(req.body.weeklyTargetMinutes)
		: undefined;
	const workDays = Object.hasOwn(req.body || {}, 'workDays') ? normalizeWorkDays(req.body.workDays) : undefined;

	if (!currentName) {
		return res.status(400).json({ message: 'Nome atual do projeto e obrigatorio.' });
	}

	if (!nextName) {
		return res.status(400).json({ message: 'Novo nome do projeto e obrigatorio.' });
	}
	if (weeklyTargetMinutes !== undefined && (!Number.isInteger(weeklyTargetMinutes) || weeklyTargetMinutes < 1 || weeklyTargetMinutes > 10080)) {
		return res.status(400).json({ message: 'Meta semanal invalida.' });
	}
	if (timezone === null) {
		return res.status(400).json({ message: 'Fuso horario invalido.' });
	}

	const found = await runQuery(
		`SELECT name
		 FROM project_profiles
		 WHERE user_id = $1 AND lower(name) = lower($2)
		 LIMIT 1`,
		[req.userId, currentName]
	);

	if (!found.rows[0]) {
		return res.status(404).json({ message: 'Projeto nao encontrado.' });
	}

	if (currentName.toLocaleLowerCase('pt-BR') !== nextName.toLocaleLowerCase('pt-BR')) {
		const duplicate = await findNormalizedDuplicate(req.userId, nextName, currentName);

		if (duplicate) {
			return res.status(409).json({ message: 'Ja existe um projeto com esse nome.' });
		}
	}

	const item = await withTransaction(async (client) => {
		const updated = await client.query(
			`UPDATE project_profiles
			 SET
				name = $1,
				summary = CASE WHEN $2::boolean THEN $3 ELSE summary END,
				project_type = CASE WHEN $4::boolean THEN $5 ELSE project_type END,
				professional_tracking_enabled = CASE WHEN $6::boolean THEN $7 ELSE professional_tracking_enabled END,
				weekly_target_minutes = COALESCE($8, weekly_target_minutes),
				work_days = COALESCE($9::jsonb, work_days),
				timezone = COALESCE($10, timezone),
				updated_at = now()
			 WHERE user_id = $11 AND lower(name) = lower($12)
			 RETURNING name, summary, project_type, professional_tracking_enabled,
			           weekly_target_minutes, work_days, timezone, created_at, updated_at`,
			[
				nextName,
				Object.hasOwn(req.body || {}, 'summary'), normalizeText(req.body?.summary),
				Object.hasOwn(req.body || {}, 'projectType'), normalizeText(req.body?.projectType) || 'Administrativo',
				Object.hasOwn(req.body || {}, 'professionalTrackingEnabled'), Boolean(req.body?.professionalTrackingEnabled),
				weeklyTargetMinutes ?? null,
				workDays === undefined ? null : JSON.stringify(workDays),
				timezone ?? null,
				req.userId, currentName,
			]
		);

		await client.query(
			`UPDATE google_drive_project_folders
			 SET project_id = $1,
				 project_name = $1,
				 updated_at = now()
			 WHERE user_id = $2 AND project_id = $3`,
			[nextName, req.userId, currentName]
		);

		await client.query(
			`UPDATE professional_journeys SET project_name = $1, updated_at = now()
			 WHERE user_id = $2 AND lower(project_name) = lower($3)`,
			[nextName, req.userId, currentName]
		);

		await client.query(
			`UPDATE professional_activities SET project_name = $1, updated_at = now()
			 WHERE user_id = $2 AND lower(project_name) = lower($3)`,
			[nextName, req.userId, currentName]
		);

		return updated.rows[0];
	});

	res.json({ item: mapProject(item) });
});

router.delete('/:name', async (req, res) => {
	const name = normalizeText(req.params?.name);
	if (!name) {
		return res.status(400).json({ message: 'Nome do projeto e obrigatorio.' });
	}

	await withTransaction(async (client) => {
		await client.query(
			`DELETE FROM project_profiles
			 WHERE user_id = $1 AND lower(name) = lower($2)
			`,
			[req.userId, name]
		);

		await client.query(
			`DELETE FROM google_drive_project_folders
			 WHERE user_id = $1 AND project_id = $2`,
			[req.userId, name]
		);

	});

	return res.status(204).send();
});

export default router;