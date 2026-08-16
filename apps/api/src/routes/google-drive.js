import { Router } from 'express';
import {
	bootstrapGoogleDriveProjectFolders,
	disconnectGoogleDrive,
	getGoogleDriveConfigChecklist,
	getGoogleDriveAuthUrl,
	getGoogleDriveOAuthUserSetupStatus,
	getGoogleDriveProjectFolderConfig,
	getGoogleDriveStatus,
	handleGoogleDriveOAuthCallback,
	saveGoogleDriveOAuthUserConfig,
	syncGoogleDriveDocument,
	testGoogleDriveConnection,
} from '../api/google-drive.js';
import { pocketbaseAuth } from '../middleware/pocketbase-auth.js';

const router = Router();

router.use('/oauth/callback', async (req, res) => {
	const state = String(req.query.state || '');
	const code = String(req.query.code || '');

	const result = await handleGoogleDriveOAuthCallback({ state, code });

	const url = new URL(result.redirectTo, 'http://localhost');
	url.searchParams.set('driveConnected', '1');
	if (result.projectId) {
		url.searchParams.set('driveProject', result.projectId);
	}

	return res.redirect(`${url.pathname}${url.search}`);
});

router.use(pocketbaseAuth);

router.get('/status', async (req, res) => {
	const result = await getGoogleDriveStatus({ userId: req.pocketbaseUserId });
	res.json(result);
});

router.get('/config-checklist', async (req, res) => {
	const result = await getGoogleDriveConfigChecklist({ userId: req.pocketbaseUserId });
	res.json(result);
});

router.get('/oauth-user-setup-status', async (req, res) => {
	const result = await getGoogleDriveOAuthUserSetupStatus();
	res.json(result);
});

router.post('/oauth-user-config', async (req, res) => {
	const result = await saveGoogleDriveOAuthUserConfig({
		clientId: req.body?.clientId,
		clientSecret: req.body?.clientSecret,
		redirectUri: req.body?.redirectUri,
		scopes: req.body?.scopes,
	});

	res.json(result);
});

router.get('/auth-url', async (req, res) => {
	const result = getGoogleDriveAuthUrl({
		userId: req.pocketbaseUserId,
		projectId: String(req.query.projectId || ''),
		projectName: String(req.query.projectName || ''),
		projectType: String(req.query.projectType || ''),
		returnTo: String(req.query.returnTo || '/projects'),
	});

	res.json(result);
});

router.get('/project-folder', async (req, res) => {
	const config = await getGoogleDriveProjectFolderConfig({
		userId: req.pocketbaseUserId,
		projectId: String(req.query.projectId || ''),
	});

	res.json({ config });
});

router.post('/projects/bootstrap', async (req, res) => {
	const result = await bootstrapGoogleDriveProjectFolders({
		userId: req.pocketbaseUserId,
		projectId: req.body?.projectId,
		projectName: req.body?.projectName,
		projectType: req.body?.projectType,
		parentFolderId: req.body?.parentFolderId,
	});

	res.json(result);
});

router.post('/disconnect', async (req, res) => {
	const result = await disconnectGoogleDrive({ userId: req.pocketbaseUserId });
	res.json(result);
});

router.post('/documents/sync', async (req, res) => {
	const result = await syncGoogleDriveDocument({
		userId: req.pocketbaseUserId,
		projectId: req.body?.projectId,
		projectName: req.body?.projectName,
		projectType: req.body?.projectType,
		driveFolderId: req.body?.driveFolderId,
		driveFileId: req.body?.driveFileId,
		fileName: req.body?.fileName,
		content: req.body?.content,
	});

	res.json(result);
});

router.post('/test-connection', async (req, res) => {
	const result = await testGoogleDriveConnection({
		userId: req.pocketbaseUserId,
		folderId: req.body?.folderId,
	});

	res.json(result);
});

export default router;