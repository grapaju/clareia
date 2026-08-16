import { Buffer } from 'node:buffer';
import Pocketbase from 'pocketbase';
import { verifyAuthToken } from '../utils/jwt.js';

function unauthorizedError(message) {
	const error = new Error(message);
	error.status = 401;
	return error;
}

export async function pocketbaseAuth(req, res, next) {
	const token = req.headers.authorization?.split(' ')?.[1];

	// Auth is enforced by default. To allow public (anonymous) access, remove this
	// middleware from the route (apps/api/src/routes/integrated-ai.js).
	if (!token) {
		return next(unauthorizedError('Please sign in or create an account to use the chat.'));
	}

	try {
		// New auth flow: JWT emitted by /auth/login and /auth/signup.
		const payload = verifyAuthToken(token);
		if (!payload?.sub) {
			return next(unauthorizedError('Your session has expired. Please sign in again.'));
		}

		req.pocketbaseUserId = String(payload.sub);
		req.authUser = {
			id: String(payload.sub),
			email: String(payload.email || ''),
			accountId: String(payload.accountId || ''),
		};

		return next();
	} catch {
		// Legacy fallback: PocketBase base64 payload from older clients.
	}

	try {
		const base64Decoded = Buffer.from(token, 'base64').toString('utf-8');
		const tokenData = JSON.parse(base64Decoded);

		if (!tokenData?.token || !tokenData?.record) {
			return next(unauthorizedError('Your session has expired. Please sign in again.'));
		}

		// by refreshing token we verify that it was not intercepted by a malicious user
		const pocketbaseClient = new Pocketbase('http://localhost:8090');
		pocketbaseClient.authStore.save(tokenData.token, tokenData.record);
		const newToken = await pocketbaseClient.collection(tokenData.record.collectionName).authRefresh();

		req.pocketbaseUserId = newToken.record.id;
		req.authUser = {
			id: String(newToken.record.id || ''),
			email: String(newToken.record.email || ''),
			accountId: String(newToken.record.currentAccountId || ''),
		};

		return next();
	} catch {
		return next(unauthorizedError('Your session has expired. Please sign in again.'));
	}
}
