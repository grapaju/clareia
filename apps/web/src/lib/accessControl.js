const PRIVILEGED_ROLES = new Set(['admin', 'owner', 'proprietario']);

export function isPrivilegedUser(user) {
  return PRIVILEGED_ROLES.has(String(user?.role || '').trim().toLowerCase());
}