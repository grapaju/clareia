export function formatDurationFriendly(minutes) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes || 0)));
  if (safeMinutes < 60) return `${safeMinutes} min`;
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${String(remainingMinutes).padStart(2, '0')}min`;
}

export function pluralizeCount(count, singular, plural) {
  const safeCount = Number(count || 0);
  return `${safeCount} ${safeCount === 1 ? singular : plural}`;
}
