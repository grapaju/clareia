export function getTaskSessionElapsedSeconds(session, now = Date.now()) {
  if (!session) return 0;
  const elapsed = Math.max(0, Number(session.elapsedSeconds || 0));
  if (session.state !== 'running' || !session.receivedAt) return elapsed;
  return elapsed + Math.max(0, Math.floor((now - session.receivedAt) / 1000));
}

export function getTaskBlockRemainingSeconds(session, now = Date.now()) {
  if (!session) return 0;
  const remaining = Math.max(0, Number(session.blockRemainingSeconds || 0));
  if (session.state !== 'running' || !session.receivedAt) return remaining;
  return Math.max(0, remaining - Math.max(0, Math.floor((now - session.receivedAt) / 1000)));
}
