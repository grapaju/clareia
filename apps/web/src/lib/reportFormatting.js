export function formatDurationFriendly(minutes) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes || 0)));
  if (safeMinutes === 0) return '0h';
  if (safeMinutes < 60) return `${safeMinutes} min`;
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h${String(remainingMinutes).padStart(2, '0')}`;
}

export function getCheckInAvailableMinutes(checkInTempo = '') {
  const tempo = String(checkInTempo).trim().toLowerCase();
  if (tempo === '15 min' || tempo === '15min') return 15;
  if (tempo === '30 min' || tempo === '30min') return 30;
  if (tempo === '1h') return 60;
  if (tempo === '2h') return 120;
  if (tempo === '4h') return 240;
  if (tempo === 'dia inteiro') return 480;
  return 120;
}

export function pluralizeCount(count, singular, plural) {
  const safeCount = Number(count || 0);
  return `${safeCount} ${safeCount === 1 ? singular : plural}`;
}
