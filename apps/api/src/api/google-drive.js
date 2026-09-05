import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import { runQuery } from '../db/postgres.js';
import logger from '../utils/logger.js';
import {
	getDriveMoveParameters,
	normalizeGoogleDocumentName,
	resolveMaterialDriveFolder,
} from '../utils/google-drive-materials.js';
import { validateMaterialUpload } from '../utils/material-upload.js';

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_DRIVE_DOCUMENT_MIME_TYPE = 'application/vnd.google-apps.document';
const GOOGLE_DRIVE_TEXT_FILE_MIME_TYPE = 'text/plain';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

// src/api/google-drive.js -> apps/api (raiz do app, onde fica o .env real)
const API_APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const oauthStates = new Map();

function createError(message, status = 500) {
	const error = new Error(message);
	error.status = status;
	return error;
}

function normalizeText(value) {
	return String(value || '').trim();
}

function normalizeNullableText(value) {
	const normalized = normalizeText(value);
	return normalized || null;
}

function getApiEnvFilePath() {
	// Nao usar process.cwd(): depende de como o PM2/npm inicia o processo e pode
	// resolver para a raiz do monorepo em vez de apps/api, fazendo o .env "sumir".
	return path.resolve(API_APP_ROOT, '.env');
}

function upsertEnvValue(content, key, value) {
	const normalizedValue = String(value || '').replace(/\r?\n/g, ' ').trim();
	const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const line = `${key}=${normalizedValue}`;
	const pattern = new RegExp(`^${escapedKey}=.*$`, 'm');

	if (pattern.test(content)) {
		return content.replace(pattern, line);
	}

	const base = content.endsWith('\n') || content.length === 0 ? content : `${content}\n`;
	return `${base}${line}\n`;
}

async function persistOAuthConfigInEnv({ clientId, clientSecret, redirectUri, scopes }) {
	const envPath = getApiEnvFilePath();
	let current = '';

	try {
		current = await fs.readFile(envPath, 'utf8');
	} catch (error) {
		if (error?.code !== 'ENOENT') {
			throw error;
		}
	}

	let next = current;
	next = upsertEnvValue(next, 'GOOGLE_OAUTH_CLIENT_ID', clientId);
	next = upsertEnvValue(next, 'GOOGLE_OAUTH_CLIENT_SECRET', clientSecret);
	next = upsertEnvValue(next, 'GOOGLE_OAUTH_REDIRECT_URI', redirectUri);
	next = upsertEnvValue(next, 'GOOGLE_OAUTH_SCOPES', scopes);

	await fs.writeFile(envPath, next, 'utf8');
}

function parseScopes() {
	const rawScopes = normalizeText(process.env.GOOGLE_OAUTH_SCOPES)
		|| 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

	return rawScopes
		.split(/[\s,]+/)
		.map((scope) => scope.trim())
		.filter(Boolean);
}

function getOAuthConfig() {
	const clientId = normalizeText(process.env.GOOGLE_OAUTH_CLIENT_ID);
	const clientSecret = normalizeText(process.env.GOOGLE_OAUTH_CLIENT_SECRET);
	const redirectUri = normalizeText(process.env.GOOGLE_OAUTH_REDIRECT_URI);

	if (!clientId || !clientSecret || !redirectUri) {
		throw createError('Google OAuth nao configurado na API.', 500);
	}

	return {
		clientId,
		clientSecret,
		redirectUri,
	};
}

function createOAuthClient() {
	const config = getOAuthConfig();
	return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

function getEncryptionKey() {
	const seed = normalizeText(process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY);

	if (!seed) {
		throw createError('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY nao configurada.', 500);
	}

	return crypto.createHash('sha256').update(seed, 'utf8').digest();
}

function encryptValue(value) {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
	const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();

	return [
		iv.toString('base64url'),
		authTag.toString('base64url'),
		encrypted.toString('base64url'),
	].join('.');
}

function decryptValue(serialized) {
	const parts = normalizeText(serialized).split('.');
	if (parts.length !== 3) {
		throw createError('Token criptografado invalido.', 500);
	}

	const [ivPart, authTagPart, encryptedPart] = parts;
	const decipher = crypto.createDecipheriv(
		'aes-256-gcm',
		getEncryptionKey(),
		Buffer.from(ivPart, 'base64url'),
	);

	decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));

	return Buffer.concat([
		decipher.update(Buffer.from(encryptedPart, 'base64url')),
		decipher.final(),
	]).toString('utf8');
}

function getDriveDefaultSubfoldersByType(projectType) {
	const normalizedType = normalizeText(projectType).toLocaleLowerCase('pt-BR');

	if (normalizedType.includes('google ads')) {
		return [
			'Briefing',
			'Criativos',
			'Prints',
			'Relatorios',
			'Alteracoes realizadas',
			'Historico',
		];
	}

	if (normalizedType.includes('sistema') || normalizedType.includes('crm')) {
		return [
			'Escopo',
			'Prints',
			'Documentacao',
			'Deploy',
			'Bugs',
			'Acessos',
			'Historico',
		];
	}

	return [
		'Orcamentos',
		'Contratos',
		'Reunioes',
		'Propostas',
		'Documentos enviados',
		'Documentos recebidos',
		'Prints',
		'Historico',
	];
}

function cleanupOAuthState() {
	const now = Date.now();

	for (const [key, value] of oauthStates.entries()) {
		if (value.expiresAt <= now) {
			oauthStates.delete(key);
		}
	}
}

function createOAuthState(payload) {
	cleanupOAuthState();

	const state = crypto.randomUUID();
	oauthStates.set(state, {
		...payload,
		expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
	});

	return state;
}

function consumeOAuthState(state) {
	cleanupOAuthState();

	const found = oauthStates.get(state);
	oauthStates.delete(state);

	if (!found || found.expiresAt <= Date.now()) {
		throw createError('Estado OAuth expirado. Tente conectar novamente.', 400);
	}

	return found;
}

function quoteQueryString(value) {
	return String(value || '').replace(/'/g, "\\'");
}

function buildDocumentBody(content) {
	const normalized = String(content || '').trim();
	if (normalized) {
		return normalized;
	}

	return `Documento criado automaticamente pelo Clareia em ${new Date().toLocaleString('pt-BR')}.`;
}

async function getConnectionByUserId(userId) {
	const result = await runQuery(
		`SELECT user_id, email, scope, encrypted_refresh_token, default_parent_folder_id, default_parent_folder_url, default_parent_folder_name, connected_at, status
		 FROM google_drive_connections
		 WHERE user_id = $1
		 LIMIT 1`,
		[userId]
	);

	const row = result.rows[0];
	if (!row) {
		return null;
	}

	return {
		userId: row.user_id,
		email: row.email,
		scope: row.scope,
		encryptedRefreshToken: row.encrypted_refresh_token,
		defaultParentFolderId: row.default_parent_folder_id,
		defaultParentFolderUrl: row.default_parent_folder_url,
		defaultParentFolderName: row.default_parent_folder_name,
		connectedAt: row.connected_at,
		status: row.status,
	};
}

async function getProjectFolderByUserAndProjectId({ userId, projectId }) {
	const result = await runQuery(
		`SELECT user_id, project_id, project_name, project_type, root_folder_id, root_folder_url, subfolders_json, last_synced_at
		 FROM google_drive_project_folders
		 WHERE user_id = $1 AND project_id = $2
		 LIMIT 1`,
		[userId, projectId]
	);

	const row = result.rows[0];
	if (!row) {
		return null;
	}

	return {
		userId: row.user_id,
		projectId: row.project_id,
		projectName: row.project_name,
		projectType: row.project_type,
		rootFolderId: row.root_folder_id,
		rootFolderUrl: row.root_folder_url,
		subfoldersJson: JSON.stringify(row.subfolders_json || []),
		lastSyncedAt: row.last_synced_at,
	};
}

async function getProjectFolderLinkByUserAndFolderId({ userId, folderId }) {
	const result = await runQuery(
		`SELECT user_id, project_id, folder_id, parent_folder_id, folder_name, drive_folder_id, drive_folder_url
		 FROM google_drive_project_folder_links
		 WHERE user_id = $1 AND folder_id = $2
		 LIMIT 1`,
		[userId, folderId]
	);

	const row = result.rows[0];
	if (!row) return null;

	return {
		userId: row.user_id,
		projectId: row.project_id,
		folderId: row.folder_id,
		parentFolderId: row.parent_folder_id,
		folderName: row.folder_name,
		driveFolderId: row.drive_folder_id,
		driveFolderUrl: row.drive_folder_url,
	};
}

async function upsertProjectFolderLink({ userId, projectId, folderId, parentFolderId, folderName, driveFolderId, driveFolderUrl }) {
	await runQuery(
		`INSERT INTO google_drive_project_folder_links (
			user_id, project_id, folder_id, parent_folder_id, folder_name, drive_folder_id, drive_folder_url
		)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (user_id, folder_id)
		 DO UPDATE SET
			parent_folder_id = EXCLUDED.parent_folder_id,
			folder_name = EXCLUDED.folder_name,
			drive_folder_id = EXCLUDED.drive_folder_id,
			drive_folder_url = EXCLUDED.drive_folder_url,
			updated_at = now()
		 WHERE google_drive_project_folder_links.project_id = EXCLUDED.project_id`,
		[userId, projectId, folderId, normalizeNullableText(parentFolderId), folderName, driveFolderId, driveFolderUrl]
	);
}

async function getMaterialUploadReceipt({ userId, receiptId }) {
	const result = await runQuery(
		`SELECT id, user_id, project_id, folder_id, drive_file_id, file_name, mime_type,
		        size_bytes, web_view_link, status
		 FROM google_drive_material_uploads
		 WHERE id = $1 AND user_id = $2
		 LIMIT 1`,
		[receiptId, userId]
	);
	return result.rows[0] || null;
}

async function upsertConnectionByUserId({ userId, payload }) {
	await runQuery(
		`INSERT INTO google_drive_connections (
			user_id,
			email,
			scope,
			encrypted_refresh_token,
			default_parent_folder_id,
			default_parent_folder_url,
			default_parent_folder_name,
			connected_at,
			status,
			updated_at
		)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, now())
		 ON CONFLICT (user_id)
		 DO UPDATE SET
			email = EXCLUDED.email,
			scope = EXCLUDED.scope,
			encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
			default_parent_folder_id = COALESCE(EXCLUDED.default_parent_folder_id, google_drive_connections.default_parent_folder_id),
			default_parent_folder_url = COALESCE(EXCLUDED.default_parent_folder_url, google_drive_connections.default_parent_folder_url),
			default_parent_folder_name = COALESCE(EXCLUDED.default_parent_folder_name, google_drive_connections.default_parent_folder_name),
			connected_at = EXCLUDED.connected_at,
			status = EXCLUDED.status,
			updated_at = now()`,
		[
			userId,
			normalizeText(payload.email),
			normalizeText(payload.scope),
			normalizeText(payload.encryptedRefreshToken),
			normalizeNullableText(payload.defaultParentFolderId),
			normalizeNullableText(payload.defaultParentFolderUrl),
			normalizeNullableText(payload.defaultParentFolderName),
			normalizeNullableText(payload.connectedAt),
			normalizeText(payload.status) || 'connected',
		]
	);
}

async function updateConnectionDefaultParentFolderByUserId({ userId, parentFolderId, parentFolderUrl, parentFolderName }) {
	await runQuery(
		`UPDATE google_drive_connections
		 SET
			default_parent_folder_id = $2,
			default_parent_folder_url = $3,
			default_parent_folder_name = $4,
			updated_at = now()
		 WHERE user_id = $1`,
		[
			userId,
			normalizeNullableText(parentFolderId),
			normalizeNullableText(parentFolderUrl),
			normalizeNullableText(parentFolderName),
		]
	);
}

function extractDriveFolderIdFromUrl(url) {
	const value = normalizeText(url);
	if (!value) return '';

	const folderMatch = value.match(/\/folders\/([a-zA-Z0-9_-]+)/i);
	if (folderMatch?.[1]) return folderMatch[1];

	const idParamMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
	if (idParamMatch?.[1]) return idParamMatch[1];

	return '';
}
async function upsertProjectFolder({ userId, projectId, payload }) {
	await runQuery(
		`INSERT INTO google_drive_project_folders (
			user_id,
			project_id,
			project_name,
			project_type,
			root_folder_id,
			root_folder_url,
			subfolders_json,
			last_synced_at,
			updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz, now())
		ON CONFLICT (user_id, project_id)
		DO UPDATE SET
			project_name = EXCLUDED.project_name,
			project_type = EXCLUDED.project_type,
			root_folder_id = EXCLUDED.root_folder_id,
			root_folder_url = EXCLUDED.root_folder_url,
			subfolders_json = EXCLUDED.subfolders_json,
			last_synced_at = EXCLUDED.last_synced_at,
			updated_at = now()`,
		[
			userId,
			projectId,
			normalizeText(payload.projectName),
			normalizeText(payload.projectType),
			normalizeText(payload.rootFolderId),
			normalizeText(payload.rootFolderUrl),
			normalizeText(payload.subfoldersJson) || '[]',
			normalizeText(payload.lastSyncedAt) || null,
		]
	);
}

async function deleteProjectFolderByUserAndProjectId({ userId, projectId }) {
	await runQuery(
		`DELETE FROM google_drive_project_folders
		 WHERE user_id = $1 AND project_id = $2`,
		[userId, projectId]
	);
}

export function getGoogleDriveAuthUrl({ userId, projectId, projectName, projectType, returnTo }) {
	const oauthClient = createOAuthClient();
	const state = createOAuthState({
		userId,
		projectId: normalizeText(projectId),
		projectName: normalizeText(projectName),
		projectType: normalizeText(projectType),
		returnTo: normalizeText(returnTo),
	});

	const authUrl = oauthClient.generateAuthUrl({
		access_type: 'offline',
		prompt: 'consent',
		include_granted_scopes: true,
		scope: parseScopes(),
		state,
	});

	return { authUrl };
}

function getSafeRedirectTarget(returnTo) {
	const normalized = normalizeText(returnTo);
	if (normalized.startsWith('/')) {
		return normalized;
	}

	return '/projects';
}

export async function handleGoogleDriveOAuthCallback({ state, code }) {
	if (!normalizeText(state) || !normalizeText(code)) {
		throw createError('Parametros de callback OAuth invalidos.', 400);
	}

	const oauthState = consumeOAuthState(state);
	const oauthClient = createOAuthClient();
	const tokenResponse = await oauthClient.getToken(code);
	const tokens = tokenResponse.tokens || {};

	if (!tokens.refresh_token) {
		const previous = await getConnectionByUserId(oauthState.userId);
		if (!previous?.encryptedRefreshToken) {
			throw createError('Google nao retornou refresh token. Reconecte e aceite as permissoes.', 400);
		}
	}

	oauthClient.setCredentials(tokens);
	const oauth2Api = google.oauth2({ version: 'v2', auth: oauthClient });
	const profile = await oauth2Api.userinfo.get();

	const refreshToken = tokens.refresh_token
		? tokens.refresh_token
		: decryptValue((await getConnectionByUserId(oauthState.userId)).encryptedRefreshToken);

	await upsertConnectionByUserId({
		userId: oauthState.userId,
		payload: {
			email: normalizeText(profile?.data?.email),
			scope: normalizeText(tokens.scope),
			encryptedRefreshToken: encryptValue(refreshToken),
			connectedAt: new Date().toISOString(),
			status: 'connected',
		},
	});

	return {
		redirectTo: getSafeRedirectTarget(oauthState.returnTo),
		projectId: oauthState.projectId,
		projectName: oauthState.projectName,
		projectType: oauthState.projectType,
	};
}

async function createDriveClientForUser(userId) {
	const connection = await getConnectionByUserId(userId);

	if (!connection?.encryptedRefreshToken) {
		throw createError('Google Drive ainda nao conectado para este usuario.', 400);
	}

	const oauthClient = createOAuthClient();
	oauthClient.setCredentials({
		refresh_token: decryptValue(connection.encryptedRefreshToken),
	});

	return {
		auth: oauthClient,
		drive: google.drive({ version: 'v3', auth: oauthClient }),
		connection,
	};
}

async function findFolderByName({ drive, parentId, name }) {
	const escapedName = quoteQueryString(name);
	const parentClause = parentId ? `'${quoteQueryString(parentId)}' in parents and ` : '';
	const query = `${parentClause}mimeType='${GOOGLE_DRIVE_FOLDER_MIME_TYPE}' and trashed=false and name='${escapedName}'`;

	const response = await drive.files.list({
		q: query,
		fields: 'files(id,name,webViewLink)',
		pageSize: 2,
	});

	const matches = response.data.files || [];
	if (matches.length > 1) {
		throw createError(`Existem varias pastas chamadas "${name}" neste destino do Google Drive. Vincule a pasta correta antes de continuar.`, 409);
	}

	return matches[0] || null;
}

async function createFolderIfMissing({ drive, parentId, name }) {
	const found = await findFolderByName({ drive, parentId, name });
	if (found) {
		return found;
	}

	const created = await drive.files.create({
		requestBody: {
			name,
			mimeType: GOOGLE_DRIVE_FOLDER_MIME_TYPE,
			...(parentId ? { parents: [parentId] } : {}),
		},
		fields: 'id,name,webViewLink',
	});

	return created.data;
}

const APP_ROOT_FOLDER_NAME = 'Clareia';

// IDs de pasta do Google Drive tem no minimo ~15 caracteres alfanumericos/-/_.
// Valores curtos ou invalidos (ex: '.') nao devem ser usados como parentId.
function isValidDriveFolderId(value) {
	return /^[a-zA-Z0-9_-]{10,}$/.test(String(value || '').trim());
}

async function getOrCreateAppRootFolder(drive) {
	return createFolderIfMissing({ drive, parentId: null, name: APP_ROOT_FOLDER_NAME });
}

export async function getGoogleDriveStatus({ userId }) {
	const connection = await getConnectionByUserId(userId);

	if (!connection) {
		return { connected: false };
	}

	return {
		connected: true,
		email: normalizeText(connection.email),
		scope: normalizeText(connection.scope),
		defaultParentFolderId: normalizeText(connection.defaultParentFolderId),
		defaultParentFolderUrl: normalizeText(connection.defaultParentFolderUrl),
		defaultParentFolderName: normalizeText(connection.defaultParentFolderName),
		connectedAt: connection.connectedAt,
		status: normalizeText(connection.status) || 'connected',
	};
}

export async function disconnectGoogleDrive({ userId }) {
	const connection = await getConnectionByUserId(userId);
	if (!connection) {
		return { disconnected: true };
	}

	await runQuery('DELETE FROM google_drive_connections WHERE user_id = $1', [userId]);

	return { disconnected: true };
}

async function driveFolderExists({ drive, folderId }) {
	if (!isValidDriveFolderId(folderId)) return false;

	try {
		const response = await drive.files.get({ fileId: folderId, fields: 'id,trashed' });
		return Boolean(response.data?.id) && !response.data.trashed;
	} catch {
		return false;
	}
}

export async function bootstrapGoogleDriveProjectFolders({ userId, projectId, projectName, projectType, parentFolderId }) {
	const normalizedProjectId = normalizeText(projectId);
	const normalizedProjectName = normalizeText(projectName) || normalizedProjectId;
	const normalizedProjectType = normalizeText(projectType) || 'Administrativo';

	if (!normalizedProjectId || !normalizedProjectName) {
		throw createError('projectId e projectName sao obrigatorios.', 400);
	}
	await assertProjectOwnership({ userId, projectId: normalizedProjectId });

	const { drive, connection } = await createDriveClientForUser(userId);

	const existing = await getProjectFolderByUserAndProjectId({ userId, projectId: normalizedProjectId });
	if (existing?.rootFolderId && (await driveFolderExists({ drive, folderId: existing.rootFolderId }))) {
		return {
			projectId: normalizedProjectId,
			projectName: normalizedProjectName,
			rootFolderId: existing.rootFolderId,
			rootFolderUrl: existing.rootFolderUrl,
			subfolders: JSON.parse(existing.subfoldersJson || '[]'),
			reused: true,
		};
	}

	const requestedParentId = normalizeText(parentFolderId);
	const defaultParentId = normalizeText(connection?.defaultParentFolderId);
	const parentId = isValidDriveFolderId(requestedParentId)
		? requestedParentId
		: (isValidDriveFolderId(defaultParentId)
			? defaultParentId
			: (await getOrCreateAppRootFolder(drive)).id);

	const rootFolder = await createFolderIfMissing({
		drive,
		parentId,
		name: normalizedProjectName,
	});

	const subfolderNames = getDriveDefaultSubfoldersByType(normalizedProjectType);
	const createdSubfolders = [];

	for (const folderName of subfolderNames) {
		const folder = await createFolderIfMissing({
			drive,
			parentId: rootFolder.id,
			name: folderName,
		});

		createdSubfolders.push({
			id: folder.id,
			name: folder.name,
			url: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`,
		});
	}

	await upsertProjectFolder({
		userId,
		projectId: normalizedProjectId,
		payload: {
			projectName: normalizedProjectName,
			projectType: normalizedProjectType,
			rootFolderId: rootFolder.id,
			rootFolderUrl: rootFolder.webViewLink || `https://drive.google.com/drive/folders/${rootFolder.id}`,
			subfoldersJson: JSON.stringify(createdSubfolders),
			lastSyncedAt: new Date().toISOString(),
		},
	});

	return {
		projectId: normalizedProjectId,
		projectName: normalizedProjectName,
		rootFolderId: rootFolder.id,
		rootFolderUrl: rootFolder.webViewLink || `https://drive.google.com/drive/folders/${rootFolder.id}`,
		subfolders: createdSubfolders,
		reused: false,
	};
}

async function assertProjectOwnership({ userId, projectId }) {
	const result = await runQuery(
		`SELECT name, project_type
		 FROM project_profiles
		 WHERE user_id = $1 AND name = $2
		 LIMIT 1`,
		[userId, projectId]
	);

	if (!result.rows[0]) {
		throw createError('Projeto nao encontrado para este usuario.', 404);
	}

	return result.rows[0];
}

export async function syncGoogleDriveProjectFolder({ userId, projectId, projectName, projectType, folderId, parentFolderId, folderName }) {
	const normalizedUserId = normalizeText(userId);
	const normalizedProjectId = normalizeText(projectId);
	const normalizedFolderId = normalizeText(folderId);
	const normalizedParentFolderId = normalizeText(parentFolderId);
	const normalizedFolderName = normalizeText(folderName);

	if (!normalizedUserId || !normalizedProjectId || !normalizedFolderId || !normalizedFolderName) {
		throw createError('projectId, folderId e folderName sao obrigatorios.', 400);
	}

	const project = await assertProjectOwnership({ userId: normalizedUserId, projectId: normalizedProjectId });
	const existingLink = await getProjectFolderLinkByUserAndFolderId({ userId: normalizedUserId, folderId: normalizedFolderId });
	if (existingLink && existingLink.projectId !== normalizedProjectId) {
		throw createError('A pasta informada pertence a outro projeto.', 403);
	}

	const root = await bootstrapGoogleDriveProjectFolders({
		userId: normalizedUserId,
		projectId: normalizedProjectId,
		projectName: normalizeText(projectName) || project.name,
		projectType: normalizeText(projectType) || project.project_type || 'Administrativo',
		parentFolderId: null,
	});

	let parentDriveFolderId = root.rootFolderId;
	if (normalizedParentFolderId) {
		const parentLink = await getProjectFolderLinkByUserAndFolderId({
			userId: normalizedUserId,
			folderId: normalizedParentFolderId,
		});
		if (!parentLink || parentLink.projectId !== normalizedProjectId) {
			throw createError('A pasta superior nao pertence a este projeto ou ainda nao foi sincronizada.', 409);
		}
		parentDriveFolderId = parentLink.driveFolderId;
	}

	const { drive } = await createDriveClientForUser(normalizedUserId);
	let driveFolder = existingLink?.driveFolderId && await driveFolderExists({ drive, folderId: existingLink.driveFolderId })
		? { id: existingLink.driveFolderId, name: existingLink.folderName, webViewLink: existingLink.driveFolderUrl }
		: null;

	if (!driveFolder) {
		driveFolder = await createFolderIfMissing({
			drive,
			parentId: parentDriveFolderId,
			name: normalizedFolderName,
		});
	}

	const driveFolderUrl = normalizeText(driveFolder.webViewLink) || `https://drive.google.com/drive/folders/${driveFolder.id}`;
	await upsertProjectFolderLink({
		userId: normalizedUserId,
		projectId: normalizedProjectId,
		folderId: normalizedFolderId,
		parentFolderId: normalizedParentFolderId,
		folderName: normalizedFolderName,
		driveFolderId: driveFolder.id,
		driveFolderUrl,
	});

	return {
		projectId: normalizedProjectId,
		folderId: normalizedFolderId,
		parentFolderId: normalizedParentFolderId || null,
		folderName: normalizedFolderName,
		driveFolderId: driveFolder.id,
		driveFolderUrl,
		reused: Boolean(existingLink),
	};
}

export async function saveGoogleDriveDefaultParentFolder({ userId, parentFolderId, parentFolderUrl }) {
	const connection = await getConnectionByUserId(userId);
	if (!connection?.encryptedRefreshToken) {
		throw createError('Conecte o Google Drive antes de definir a pasta mae padrao.', 400);
	}

	const normalizedParentFolderId = normalizeText(parentFolderId) || extractDriveFolderIdFromUrl(parentFolderUrl);
	const normalizedParentFolderUrl = normalizeText(parentFolderUrl);

	if (!normalizedParentFolderId) {
		throw createError('Informe um link ou id valido da pasta mae.', 400);
	}

	if (!isValidDriveFolderId(normalizedParentFolderId)) {
		throw createError('Id da pasta mae invalido.', 400);
	}

	const { drive } = await createDriveClientForUser(userId);
	let folderMeta = null;

	try {
		const response = await drive.files.get({
			fileId: normalizedParentFolderId,
			fields: 'id,name,mimeType,trashed,webViewLink',
		});
		folderMeta = response.data || null;
	} catch {
		throw createError('Pasta mae nao encontrada no Google Drive.', 404);
	}

	if (!folderMeta?.id || folderMeta.trashed || folderMeta.mimeType !== GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
		throw createError('A referencia informada nao corresponde a uma pasta ativa do Google Drive.', 400);
	}

	await updateConnectionDefaultParentFolderByUserId({
		userId,
		parentFolderId: folderMeta.id,
		parentFolderUrl: normalizeText(folderMeta.webViewLink) || normalizedParentFolderUrl || `https://drive.google.com/drive/folders/${folderMeta.id}`,
		parentFolderName: normalizeText(folderMeta.name),
	});

	return getGoogleDriveStatus({ userId });
}

export async function getGoogleDriveProjectFolderConfig({ userId, projectId }) {
	const normalizedProjectId = normalizeText(projectId);
	if (!normalizedProjectId) {
		throw createError('projectId e obrigatorio.', 400);
	}

	const record = await getProjectFolderByUserAndProjectId({ userId, projectId: normalizedProjectId });
	if (!record) {
		return null;
	}

	try {
		const { drive } = await createDriveClientForUser(userId);
		if (record.rootFolderId && !(await driveFolderExists({ drive, folderId: record.rootFolderId }))) {
			await deleteProjectFolderByUserAndProjectId({ userId, projectId: normalizedProjectId });
			return null;
		}
	} catch {
		// Se usuario estiver desconectado, mantemos o registro para reaproveitar apos reconexao.
	}

	return {
		projectId: record.projectId,
		projectName: record.projectName,
		projectType: record.projectType,
		rootFolderId: record.rootFolderId,
		rootFolderUrl: record.rootFolderUrl,
		subfolders: JSON.parse(record.subfoldersJson || '[]'),
		lastSyncedAt: record.lastSyncedAt,
	};
}

export async function saveGoogleDriveProjectFolderConfig({ userId, projectId, projectName, projectType, rootFolderId, rootFolderUrl }) {
	const normalizedProjectId = normalizeText(projectId);
	const normalizedProjectName = normalizeText(projectName) || normalizedProjectId;
	const normalizedProjectType = normalizeText(projectType) || 'Administrativo';
	const normalizedRootFolderId = normalizeText(rootFolderId);
	const normalizedRootFolderUrl = normalizeText(rootFolderUrl)
		|| (normalizedRootFolderId ? `https://drive.google.com/drive/folders/${normalizedRootFolderId}` : '');

	if (!normalizedProjectId || !normalizedProjectName) {
		throw createError('projectId e projectName sao obrigatorios.', 400);
	}
	await assertProjectOwnership({ userId, projectId: normalizedProjectId });

	if (!normalizedRootFolderId && !normalizedRootFolderUrl) {
		throw createError('rootFolderId ou rootFolderUrl e obrigatorio.', 400);
	}

	await upsertProjectFolder({
		userId,
		projectId: normalizedProjectId,
		payload: {
			projectName: normalizedProjectName,
			projectType: normalizedProjectType,
			rootFolderId: normalizedRootFolderId,
			rootFolderUrl: normalizedRootFolderUrl,
			subfoldersJson: '[]',
			lastSyncedAt: new Date().toISOString(),
		},
	});

	return getGoogleDriveProjectFolderConfig({ userId, projectId: normalizedProjectId });
}

export async function removeGoogleDriveProjectFolderConfig({ userId, projectId }) {
	const normalizedProjectId = normalizeText(projectId);
	if (!normalizedProjectId) {
		throw createError('projectId e obrigatorio.', 400);
	}

	await deleteProjectFolderByUserAndProjectId({ userId, projectId: normalizedProjectId });

	return {
		removed: true,
		projectId: normalizedProjectId,
	};
}

async function resolveTargetFolderId({ userId, projectId, projectName, projectType, folderId }) {
	const normalizedProjectId = normalizeText(projectId);
	if (!normalizedProjectId) {
		return null;
	}
	await assertProjectOwnership({ userId, projectId: normalizedProjectId });

	const normalizedFolderId = normalizeText(folderId);
	if (normalizedFolderId) {
		const folderLink = await getProjectFolderLinkByUserAndFolderId({ userId, folderId: normalizedFolderId });
		return resolveMaterialDriveFolder({
			projectId: normalizedProjectId,
			folderId: normalizedFolderId,
			folderLink,
		});
	}

	const existing = await getProjectFolderByUserAndProjectId({ userId, projectId: normalizedProjectId });
	if (existing?.rootFolderId) {
		return resolveMaterialDriveFolder({
			projectId: normalizedProjectId,
			folderId: '',
			rootDriveFolderId: existing.rootFolderId,
		});
	}

	const normalizedProjectName = normalizeText(projectName);
	if (!normalizedProjectName) {
		return null;
	}

	const bootstrapped = await bootstrapGoogleDriveProjectFolders({
		userId,
		projectId: normalizedProjectId,
		projectName: normalizedProjectName,
		projectType: normalizeText(projectType) || 'Administrativo',
		parentFolderId: null,
	});

	return normalizeText(bootstrapped?.rootFolderId) || null;
}

async function replaceGoogleDocumentContent({ docs, documentId, content }) {
	const document = await docs.documents.get({ documentId });
	const endIndex = document.data.body?.content?.at(-1)?.endIndex || 1;
	const requests = [];
	if (endIndex > 2) {
		requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
	}
	requests.push({ insertText: { location: { index: 1 }, text: content } });
	await docs.documents.batchUpdate({ documentId, requestBody: { requests } });
}

export async function syncGoogleDriveDocument({ userId, projectId, projectName, projectType, folderId, driveFileId, fileName, content }) {
	const normalizedUserId = normalizeText(userId);
	if (!normalizedUserId) {
		throw createError('Usuario invalido para sincronizacao com Google Drive.', 400);
	}

	const finalFileName = normalizeGoogleDocumentName(fileName);
	const body = buildDocumentBody(content);
	const targetDriveFolderId = await resolveTargetFolderId({
		userId: normalizedUserId,
		projectId,
		projectName,
		projectType,
		folderId,
	});

	const { drive, auth } = await createDriveClientForUser(normalizedUserId);
	const normalizedDriveFileId = normalizeText(driveFileId);

	if (normalizedDriveFileId) {
		const current = await drive.files.get({ fileId: normalizedDriveFileId, fields: 'id,mimeType,parents' });
		const currentParents = current.data.parents || [];
		const move = getDriveMoveParameters({ targetDriveFolderId, currentParents });
		const updated = await drive.files.update({
			fileId: normalizedDriveFileId,
			requestBody: {
				name: finalFileName,
			},
			...(move.moved ? { addParents: move.addParents, removeParents: move.removeParents } : {}),
			fields: 'id,name,webViewLink,mimeType,parents',
		});

		if (current.data.mimeType === GOOGLE_DRIVE_DOCUMENT_MIME_TYPE) {
			await replaceGoogleDocumentContent({
				docs: google.docs({ version: 'v1', auth }),
				documentId: normalizedDriveFileId,
				content: body,
			});
		} else {
			await drive.files.update({
				fileId: normalizedDriveFileId,
				media: { mimeType: GOOGLE_DRIVE_TEXT_FILE_MIME_TYPE, body: Readable.from([body]) },
			});
		}

		return {
			driveFileId: updated.data.id,
			driveFolderId: normalizeText(updated.data.parents?.[0]) || targetDriveFolderId || '',
			fileName: updated.data.name,
			webViewLink: updated.data.webViewLink || `https://drive.google.com/file/d/${updated.data.id}/view`,
			created: false,
			updated: true,
			moved: move.moved,
		};
	}

	const created = await drive.files.create({
		requestBody: {
			name: finalFileName,
			mimeType: GOOGLE_DRIVE_DOCUMENT_MIME_TYPE,
			...(targetDriveFolderId ? { parents: [targetDriveFolderId] } : {}),
		},
		media: {
			mimeType: GOOGLE_DRIVE_TEXT_FILE_MIME_TYPE,
			body: Readable.from([body]),
		},
		fields: 'id,name,webViewLink,mimeType,parents',
	});

	return {
		driveFileId: created.data.id,
		driveFolderId: normalizeText(created.data.parents?.[0]) || targetDriveFolderId || '',
		fileName: created.data.name,
		webViewLink: created.data.webViewLink || `https://drive.google.com/file/d/${created.data.id}/view`,
		created: true,
		updated: false,
		moved: false,
	};
}

export async function uploadGoogleDriveMaterial({ userId, projectId, projectName, projectType, folderId, file }) {
	const normalizedUserId = normalizeText(userId);
	const normalizedProjectId = normalizeText(projectId);
	const normalizedFolderId = normalizeText(folderId);
	if (!normalizedUserId || !normalizedProjectId || !normalizedFolderId) {
		throw createError('Projeto e pasta sao obrigatorios para enviar um arquivo.', 400);
	}

	const validatedFile = await validateMaterialUpload(file);
	const targetDriveFolderId = await resolveTargetFolderId({
		userId: normalizedUserId,
		projectId: normalizedProjectId,
		projectName,
		projectType,
		folderId: normalizedFolderId,
	});
	const { drive } = await createDriveClientForUser(normalizedUserId);
	const created = await drive.files.create({
		requestBody: {
			name: validatedFile.fileName,
			parents: [targetDriveFolderId],
		},
		media: {
			mimeType: validatedFile.mimeType,
			body: Readable.from(file.buffer),
		},
		fields: 'id,name,webViewLink,mimeType,parents,size',
	});

	const receiptId = crypto.randomUUID();
	const webViewLink = normalizeText(created.data.webViewLink)
		|| `https://drive.google.com/file/d/${created.data.id}/view`;

	try {
		await runQuery(
			`INSERT INTO google_drive_material_uploads (
			   id, user_id, project_id, folder_id, drive_file_id, file_name,
			   mime_type, size_bytes, web_view_link, status
			 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')`,
			[
				receiptId,
				normalizedUserId,
				normalizedProjectId,
				normalizedFolderId,
				created.data.id,
				validatedFile.fileName,
				validatedFile.mimeType,
				validatedFile.size,
				webViewLink,
			]
		);
	} catch (error) {
		try {
			await drive.files.delete({ fileId: created.data.id });
		} catch (rollbackError) {
			logger.error('Falha ao reverter upload do Google Drive sem recibo.', rollbackError.message);
		}
		throw error;
	}

	return {
		receiptId,
		driveFileId: created.data.id,
		driveFolderId: normalizeText(created.data.parents?.[0]) || targetDriveFolderId,
		fileName: created.data.name || validatedFile.fileName,
		mimeType: created.data.mimeType || validatedFile.mimeType,
		size: Number(created.data.size || validatedFile.size),
		webViewLink,
	};
}

export async function confirmGoogleDriveMaterialUpload({ userId, receiptId }) {
	const result = await runQuery(
		`UPDATE google_drive_material_uploads
		 SET status = 'confirmed', error_message = '', updated_at = now()
		 WHERE id = $1 AND user_id = $2 AND status = 'pending'
		 RETURNING id`,
		[normalizeText(receiptId), userId]
	);
	if (!result.rows[0]) throw createError('Upload pendente nao encontrado.', 404);
	return { confirmed: true, receiptId: result.rows[0].id };
}

export async function rollbackGoogleDriveMaterialUpload({ userId, receiptId }) {
	const receipt = await getMaterialUploadReceipt({ userId, receiptId: normalizeText(receiptId) });
	if (!receipt || receipt.status !== 'pending') {
		throw createError('Upload pendente nao encontrado.', 404);
	}

	const { drive } = await createDriveClientForUser(userId);
	try {
		await drive.files.delete({ fileId: receipt.drive_file_id });
		await runQuery(
			`UPDATE google_drive_material_uploads
			 SET status = 'rolled_back', error_message = '', updated_at = now()
			 WHERE id = $1 AND user_id = $2`,
			[receipt.id, userId]
		);
	} catch (error) {
		await runQuery(
			`UPDATE google_drive_material_uploads
			 SET error_message = $3, updated_at = now()
			 WHERE id = $1 AND user_id = $2`,
			[receipt.id, userId, normalizeText(error?.message).slice(0, 500)]
		);
		throw error;
	}

	return { rolledBack: true, receiptId: receipt.id };
}

function hasEnv(name) {
	return Boolean(normalizeText(process.env[name]));
}

function parseRedirectMetadata(redirectUri) {
	const normalized = normalizeText(redirectUri);
	if (!normalized) {
		return {
			isValid: false,
			host: '',
			pathname: '',
			scheme: '',
		};
	}

	try {
		const parsed = new URL(normalized);
		return {
			isValid: true,
			host: parsed.host,
			pathname: parsed.pathname,
			scheme: parsed.protocol.replace(':', ''),
		};
	} catch {
		return {
			isValid: false,
			host: '',
			pathname: '',
			scheme: '',
		};
	}
}

export async function getGoogleDriveConfigChecklist({ userId }) {
	const redirectUri = normalizeText(process.env.GOOGLE_OAUTH_REDIRECT_URI);
	const redirect = parseRedirectMetadata(redirectUri);
	const scopes = parseScopes();
	const connection = await getConnectionByUserId(userId);

	return {
		oauth: {
			clientIdConfigured: hasEnv('GOOGLE_OAUTH_CLIENT_ID'),
			clientSecretConfigured: hasEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
			redirectUriConfigured: Boolean(redirectUri),
			redirectUriValid: redirect.isValid,
			redirectHost: redirect.host,
			redirectPathname: redirect.pathname,
			redirectScheme: redirect.scheme,
			scopesConfigured: scopes.length > 0,
			scopeCount: scopes.length,
		},
		tokenSecurity: {
			encryptionKeyConfigured: hasEnv('GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY'),
		},
		connection: {
			connected: Boolean(connection),
			email: normalizeText(connection?.email),
			defaultParentFolderConfigured: Boolean(normalizeText(connection?.defaultParentFolderId)),
			defaultParentFolderName: normalizeText(connection?.defaultParentFolderName),
			connectedAt: connection?.connectedAt || null,
			refreshTokenStored: Boolean(connection?.encryptedRefreshToken),
		},
	};
}

export async function getGoogleDriveOAuthUserSetupStatus() {
	const redirectUri = normalizeText(process.env.GOOGLE_OAUTH_REDIRECT_URI);
	const redirect = parseRedirectMetadata(redirectUri);

	return {
		canConfigureInApp: true,
		configured: Boolean(
			normalizeText(process.env.GOOGLE_OAUTH_CLIENT_ID)
			&& normalizeText(process.env.GOOGLE_OAUTH_CLIENT_SECRET)
			&& normalizeText(process.env.GOOGLE_OAUTH_REDIRECT_URI)
		),
		envPath: getApiEnvFilePath(),
		redirectPreview: {
			host: redirect.host,
			pathname: redirect.pathname,
			scheme: redirect.scheme,
			valid: redirect.isValid,
		},
	};
}

export async function saveGoogleDriveOAuthUserConfig({ clientId, clientSecret, redirectUri, scopes }) {
	const normalizedClientId = normalizeText(clientId);
	const normalizedClientSecret = normalizeText(clientSecret);
	const normalizedRedirectUri = normalizeText(redirectUri);
	const normalizedScopes = normalizeText(scopes)
		|| 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';

	if (!normalizedClientId || !normalizedClientSecret || !normalizedRedirectUri) {
		throw createError('clientId, clientSecret e redirectUri sao obrigatorios.', 400);
	}

	const redirect = parseRedirectMetadata(normalizedRedirectUri);
	if (!redirect.isValid) {
		throw createError('redirectUri invalida. Use URL completa com protocolo, host e path.', 400);
	}

	process.env.GOOGLE_OAUTH_CLIENT_ID = normalizedClientId;
	process.env.GOOGLE_OAUTH_CLIENT_SECRET = normalizedClientSecret;
	process.env.GOOGLE_OAUTH_REDIRECT_URI = normalizedRedirectUri;
	process.env.GOOGLE_OAUTH_SCOPES = normalizedScopes;

	await persistOAuthConfigInEnv({
		clientId: normalizedClientId,
		clientSecret: normalizedClientSecret,
		redirectUri: normalizedRedirectUri,
		scopes: normalizedScopes,
	});

	return {
		saved: true,
		redirectHost: redirect.host,
		redirectPathname: redirect.pathname,
		scopesCount: normalizedScopes.split(/[\s,]+/).filter(Boolean).length,
		message: 'Configuracao salva e aplicada na API atual.',
	};
}

export async function testGoogleDriveConnection({ userId, folderId }) {
	const normalizedUserId = normalizeText(userId);
	if (!normalizedUserId) {
		throw createError('Usuario invalido para testar conexao com Google Drive.', 400);
	}

	const { drive } = await createDriveClientForUser(normalizedUserId);
	const normalizedFolderId = normalizeText(folderId);
	const now = new Date();
	const dateLabel = now.toISOString().replace(/[:.]/g, '-');

	const created = await drive.files.create({
		requestBody: {
			name: `clareia-oauth-check-${dateLabel}.txt`,
			...(normalizedFolderId ? { parents: [normalizedFolderId] } : {}),
		},
		media: {
			mimeType: GOOGLE_DRIVE_TEXT_FILE_MIME_TYPE,
			body: Readable.from([
				`Teste de conexao OAuth executado em ${now.toLocaleString('pt-BR')} pelo Clareia.`,
			]),
		},
		fields: 'id,name,webViewLink,parents',
	});

	return {
		success: true,
		driveFileId: created.data.id,
		fileName: created.data.name,
		driveFolderId: normalizeText(created.data.parents?.[0]) || normalizedFolderId,
		webViewLink: created.data.webViewLink || `https://drive.google.com/file/d/${created.data.id}/view`,
	};
}