import { verifyAuthToken } from '../utils/jwt.js';

function unauthorizedError(message) {
	const error = new Error(message);
	error.status = 401;
	return error;
}

export async function requireAuth(req, res, next) {
	const token = req.headers.authorization?.split(' ')?.[1];

	if (!token) {
		return next(unauthorizedError('Please sign in or create an account to use the chat.'));
	}

	try {
		const payload = verifyAuthToken(token);
		if (!payload?.sub) {
			return next(unauthorizedError('Your session has expired. Please sign in again.'));
		}

		req.userId = String(payload.sub);
		req.authUser = {
			id: String(payload.sub),
			email: String(payload.email || ''),
			role: String(payload.role || 'user'),
			accountId: String(payload.accountId || ''),
		};

		return next();
	} catch {
		return next(unauthorizedError('Your session has expired. Please sign in again.'));
	}
}

export function requirePrivileged(req, res, next) {
	const privilegedRoles = new Set(['admin', 'owner', 'proprietario']);
	if (!privilegedRoles.has(String(req.authUser?.role || '').toLowerCase())) {
		const error = new Error('Apenas administradores podem alterar a configuracao OAuth.');
		error.status = 403;
		return next(error);
	}

	return next();
}