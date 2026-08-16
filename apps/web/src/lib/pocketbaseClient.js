const API_SERVER_URL = '/hcgi/api';
const AUTH_TOKEN_KEY = 'clareia_auth_token';
const AUTH_USER_KEY = 'clareia_auth_user';

const authListeners = new Set();

function safeParse(value, fallback = null) {
	try {
		const parsed = JSON.parse(value);
		return parsed ?? fallback;
	} catch {
		return fallback;
	}
}

function getStoredToken() {
	if (typeof window === 'undefined') return '';
	return String(window.localStorage.getItem(AUTH_TOKEN_KEY) || '');
}

function getStoredModel() {
	if (typeof window === 'undefined') return null;
	return safeParse(window.localStorage.getItem(AUTH_USER_KEY), null);
}

function notifyAuthChange() {
	const token = getStoredToken();
	const model = getStoredModel();
	authListeners.forEach((listener) => {
		try {
			listener(token, model);
		} catch {
			// ignore listener errors to keep auth flow stable
		}
	});
}

async function requestApi(path, options = {}) {
	const token = getStoredToken();
	const response = await window.fetch(`${API_SERVER_URL}${path}`, {
		...options,
		headers: {
			...(options.headers || {}),
			...(token ? { Authorization: `Bearer ${token}` } : {}),
		},
	});

	if (!response.ok) {
		const text = await response.text();
		let message = text;
		try {
			const parsed = JSON.parse(text);
			message = parsed?.message || parsed?.error?.message || message;
		} catch {
			// keep raw text
		}
		const error = new Error(message || `Request failed (${response.status})`);
		error.status = response.status;
		throw error;
	}

	if (response.status === 204) return null;
	return response.json();
}

const pocketbaseClient = {
	authStore: {
		get token() {
			return getStoredToken();
		},
		get model() {
			return getStoredModel();
		},
		get isValid() {
			return Boolean(getStoredToken() && getStoredModel()?.id);
		},
		save(token, model) {
			if (typeof window === 'undefined') return;
			window.localStorage.setItem(AUTH_TOKEN_KEY, String(token || ''));
			window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(model || null));
			notifyAuthChange();
		},
		clear() {
			if (typeof window === 'undefined') return;
			window.localStorage.removeItem(AUTH_TOKEN_KEY);
			window.localStorage.removeItem(AUTH_USER_KEY);
			notifyAuthChange();
		},
		onChange(listener) {
			authListeners.add(listener);
			return () => authListeners.delete(listener);
		},
	},
	collection(name) {
		const collectionName = String(name || '').trim();
		const basePath = `/records/${encodeURIComponent(collectionName)}`;

		return {
			async getFullList(options = {}) {
				const search = new URLSearchParams();
				if (options.sort) search.set('sort', String(options.sort));
				if (options.filter) search.set('filter', String(options.filter));

				const suffix = search.toString() ? `?${search.toString()}` : '';
				const result = await requestApi(`${basePath}${suffix}`, { method: 'GET' });
				return Array.isArray(result?.items) ? result.items : [];
			},
			async getFirstListItem(filter) {
				const items = await this.getFullList({ filter, sort: '-created' });
				if (!items.length) {
					throw new Error('no rows in result set');
				}
				return items[0];
			},
			async create(payload) {
				if (collectionName === 'users') {
					const result = await requestApi('/auth/signup', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(payload || {}),
					});
					if (result?.token && result?.user) {
						pocketbaseClient.authStore.save(result.token, result.user);
					}
					return result?.user || null;
				}

				const result = await requestApi(basePath, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload || {}),
				});
				return result?.item || null;
			},
			async update(id, payload) {
				if (collectionName === 'users') {
					const result = await requestApi('/auth/change-password', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							currentPassword: payload?.oldPassword,
							newPassword: payload?.password,
							newPasswordConfirm: payload?.passwordConfirm,
						}),
					});
					return result || { success: true };
				}

				const result = await requestApi(`${basePath}/${encodeURIComponent(String(id || ''))}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload || {}),
				});
				return result?.item || null;
			},
			async delete(id) {
				await requestApi(`${basePath}/${encodeURIComponent(String(id || ''))}`, {
					method: 'DELETE',
				});
			},
			async authWithPassword(email, password) {
				const result = await requestApi('/auth/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password }),
				});

				if (result?.token && result?.user) {
					pocketbaseClient.authStore.save(result.token, result.user);
				}

				return {
					token: result?.token,
					record: result?.user,
				};
			},
			async authRefresh() {
				const result = await requestApi('/auth/me', { method: 'GET' });
				if (result?.user) {
					pocketbaseClient.authStore.save(getStoredToken(), result.user);
				}
				return {
					record: result?.user,
					token: getStoredToken(),
				};
			},
		};
	},
};

function getCurrentAccountId() {
	return String(pocketbaseClient?.authStore?.model?.currentAccountId || '').trim();
}

export default pocketbaseClient;

export { pocketbaseClient };
export { getCurrentAccountId };
