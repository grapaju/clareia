export function withoutPlaintextPassword(payload = {}) {
  const { password: _ignoredPassword, ...safePayload } = payload;
  return safePayload;
}