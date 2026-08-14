import Pocketbase from 'pocketbase';

const POCKETBASE_API_URL = '/hcgi/platform';

const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

function getCurrentAccountId() {
	return String(pocketbaseClient?.authStore?.model?.currentAccountId || '').trim();
}

export default pocketbaseClient;

export { pocketbaseClient };
export { getCurrentAccountId };
