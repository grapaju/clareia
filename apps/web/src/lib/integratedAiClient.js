const API_SERVER_URL = '/hcgi/api';

function getAuthToken() {
	return localStorage.getItem('clareia_auth_token');
}

const integratedAiClient = {
	fetch: async (path, options = {}) => {
		const authToken = getAuthToken();

		const response = await window.fetch(API_SERVER_URL + path, {
			...options,
			headers: {
				...options.headers,
				...(authToken && { Authorization: `Bearer ${authToken}` }),
			},
		});

		if (!response.ok) {
			const errorBody = await response.text();

			let message;
			try {
				const parsed = JSON.parse(errorBody);
				message = parsed?.error?.message || parsed?.message;
			} catch {
				message = errorBody;
			}

			const error = new Error(message || `Request failed (${response.status})`);
			error.status = response.status;
			throw error;
		}

		if (response.status === 204) return null;
		return response.json();
	},

	stream: async (path, { body, signal, images } = {}) => {
		const authToken = getAuthToken();

		const headers = {
			Accept: 'text/event-stream',
			...(authToken && { Authorization: `Bearer ${authToken}` }),
		};

		const formData = new FormData();
		formData.append('message', JSON.stringify(body.message));

		images.forEach((image) => {
			formData.append('images', image);
		});

		const response = await window.fetch(API_SERVER_URL + path, {
			method: 'POST',
			headers,
			body: formData,
			signal,
		});

		if (!response.ok) {
			const errorBody = await response.text();

			let message;
			try {
				const parsed = JSON.parse(errorBody);
				message = parsed?.error?.message || parsed?.message;
			} catch {
				message = errorBody;
			}

			const error = new Error(message || `Request failed (${response.status})`);
			error.status = response.status;
			throw error;
		}

		if (!response.body) {
			throw new Error('No response body');
		}

		return response;
	},
};

export default integratedAiClient;

export { integratedAiClient };
