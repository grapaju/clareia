import { Router } from 'express';
import { runQuery, withTransaction } from '../db/postgres.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';

const router = Router();

function normalizeText(value) {
	return String(value || '').trim();
}

function mapProject(row) {
	return {
		name: row.name,
		summary: row.summary || '',
		projectType: row.project_type || 'Administrativo',
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

router.use(pocketbaseAuth);

router.get('/', async (req, res) => {
	const result = await runQuery(
		`SELECT name, summary, project_type, created_at, updated_at
		 FROM project_profiles
		 WHERE user_id = $1
		 ORDER BY lower(name) ASC`,
		[req.pocketbaseUserId]
	);

	res.json({ items: result.rows.map(mapProject) });
});

router.post('/', async (req, res) => {
	const name = normalizeText(req.body?.name);
	const summary = normalizeText(req.body?.summary);
	const projectType = normalizeText(req.body?.projectType) || 'Administrativo';

	if (!name) {
		return res.status(400).json({ message: 'Nome do projeto e obrigatorio.' });
	}

	const duplicate = await runQuery(
		`SELECT 1
		 FROM project_profiles
		 WHERE user_id = $1 AND lower(name) = lower($2)
		 LIMIT 1`,
		[req.pocketbaseUserId, name]
	);

	if (duplicate.rows[0]) {
		return res.status(409).json({ message: 'Ja existe um projeto com esse nome.' });
	}

	const created = await runQuery(
		`INSERT INTO project_profiles (user_id, name, summary, project_type)
		 VALUES ($1, $2, $3, $4)
		 RETURNING name, summary, project_type, created_at, updated_at`,
		[req.pocketbaseUserId, name, summary, projectType]
	);

	res.status(201).json({ item: mapProject(created.rows[0]) });
});

router.patch('/:name', async (req, res) => {
	const currentName = normalizeText(req.params?.name);
	const nextName = normalizeText(req.body?.name) || currentName;
	const summary = normalizeText(req.body?.summary);
	const projectType = normalizeText(req.body?.projectType) || 'Administrativo';

	if (!currentName) {
		return res.status(400).json({ message: 'Nome atual do projeto e obrigatorio.' });
	}

	if (!nextName) {
		return res.status(400).json({ message: 'Novo nome do projeto e obrigatorio.' });
	}

	const found = await runQuery(
		`SELECT name
		 FROM project_profiles
		 WHERE user_id = $1 AND lower(name) = lower($2)
		 LIMIT 1`,
		[req.pocketbaseUserId, currentName]
	);

	if (!found.rows[0]) {
		return res.status(404).json({ message: 'Projeto nao encontrado.' });
	}

	if (currentName.toLocaleLowerCase('pt-BR') !== nextName.toLocaleLowerCase('pt-BR')) {
		const duplicate = await runQuery(
			`SELECT 1
			 FROM project_profiles
			 WHERE user_id = $1 AND lower(name) = lower($2)
			 LIMIT 1`,
			[req.pocketbaseUserId, nextName]
		);

		if (duplicate.rows[0]) {
			return res.status(409).json({ message: 'Ja existe um projeto com esse nome.' });
		}
	}

	const item = await withTransaction(async (client) => {
		const updated = await client.query(
			`UPDATE project_profiles
			 SET
				name = $1,
				summary = $2,
				project_type = $3,
				updated_at = now()
			 WHERE user_id = $4 AND lower(name) = lower($5)
			 RETURNING name, summary, project_type, created_at, updated_at`,
			[nextName, summary, projectType, req.pocketbaseUserId, currentName]
		);

		await client.query(
			`UPDATE google_drive_project_folders
			 SET project_id = $1,
				 project_name = $1,
				 updated_at = now()
			 WHERE user_id = $2 AND project_id = $3`,
			[nextName, req.pocketbaseUserId, currentName]
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

	const deleted = await withTransaction(async (client) => {
		const removed = await client.query(
			`DELETE FROM project_profiles
			 WHERE user_id = $1 AND lower(name) = lower($2)
			 RETURNING name`,
			[req.pocketbaseUserId, name]
		);

		await client.query(
			`DELETE FROM google_drive_project_folders
			 WHERE user_id = $1 AND project_id = $2`,
			[req.pocketbaseUserId, name]
		);

		return removed.rows[0] || null;
	});

	if (!deleted) {
		return res.status(404).json({ message: 'Projeto nao encontrado.' });
	}

	return res.status(204).send();
});

export default router;