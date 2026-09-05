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
	removeGoogleDriveProjectFolderConfig,
	saveGoogleDriveDefaultParentFolder,
	saveGoogleDriveProjectFolderConfig,
	saveGoogleDriveOAuthUserConfig,
	syncGoogleDriveDocument,
	syncGoogleDriveProjectFolder,
	testGoogleDriveConnection,
} from '../api/google-drive.js';
import { requireAuth, requirePrivileged } from '../middleware/auth.js';

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

router.use(requireAuth);

router.get('/status', async (req, res) => {
	const result = await getGoogleDriveStatus({ userId: req.userId });
	res.json(result);
});

router.get('/config-checklist', async (req, res) => {
	const result = await getGoogleDriveConfigChecklist({ userId: req.userId });
	res.json(result);
});

router.get('/oauth-user-setup-status', async (req, res) => {
	const result = await getGoogleDriveOAuthUserSetupStatus();
	res.json(result);
});

router.post('/oauth-user-config', requirePrivileged, async (req, res) => {
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
		userId: req.userId,
		projectId: String(req.query.projectId || ''),
		projectName: String(req.query.projectName || ''),
		projectType: String(req.query.projectType || ''),
		returnTo: String(req.query.returnTo || '/projects'),
	});

	res.json(result);
});

router.get('/project-folder', async (req, res) => {
	const config = await getGoogleDriveProjectFolderConfig({
		userId: req.userId,
		projectId: String(req.query.projectId || ''),
	});

	res.json({ config });
});

router.post('/project-folder', async (req, res) => {
	const config = await saveGoogleDriveProjectFolderConfig({
		userId: req.userId,
		projectId: req.body?.projectId,
		projectName: req.body?.projectName,
		projectType: req.body?.projectType,
		rootFolderId: req.body?.rootFolderId,
		rootFolderUrl: req.body?.rootFolderUrl,
	});

	res.json({ config });
});

router.delete('/project-folder', async (req, res) => {
	const result = await removeGoogleDriveProjectFolderConfig({
		userId: req.userId,
		projectId: String(req.query.projectId || ''),
	});

	res.json(result);
});

router.post('/default-parent-folder', async (req, res) => {
	const status = await saveGoogleDriveDefaultParentFolder({
		userId: req.userId,
		parentFolderId: req.body?.parentFolderId,
		parentFolderUrl: req.body?.parentFolderUrl,
	});

	res.json(status);
});

router.post('/projects/bootstrap', async (req, res) => {
	const result = await bootstrapGoogleDriveProjectFolders({
		userId: req.userId,
		projectId: req.body?.projectId,
		projectName: req.body?.projectName,
		projectType: req.body?.projectType,
		parentFolderId: req.body?.parentFolderId,
	});

	res.json(result);
});

router.post('/project-folders/sync', async (req, res) => {
	const result = await syncGoogleDriveProjectFolder({
		userId: req.userId,
		projectId: req.body?.projectId,
		projectName: req.body?.projectName,
		projectType: req.body?.projectType,
		folderId: req.body?.folderId,
		parentFolderId: req.body?.parentFolderId,
		folderName: req.body?.folderName,
	});

	res.json(result);
});

router.post('/disconnect', async (req, res) => {
	const result = await disconnectGoogleDrive({ userId: req.userId });
	res.json(result);
});

router.post('/documents/sync', async (req, res) => {
	const result = await syncGoogleDriveDocument({
		userId: req.userId,
		projectId: req.body?.projectId,
		projectName: req.body?.projectName,
		projectType: req.body?.projectType,
		folderId: req.body?.folderId,
		driveFileId: req.body?.driveFileId,
		fileName: req.body?.fileName,
		content: req.body?.content,
	});

	res.json(result);
});

router.post('/test-connection', async (req, res) => {
	const result = await testGoogleDriveConnection({
		userId: req.userId,
		folderId: req.body?.folderId,
	});

	res.json(result);
});

export default router;