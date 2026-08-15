export function parseLocalDate(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());

  if (typeof value === 'string') {
    // Treat any ISO-like date string by its calendar date part to avoid TZ shifts.
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s].*)/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      return new Date(year, month, day);
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toLocalIsoDate(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toIsoDate(value) {
  if (!value) return '';
  const date = parseLocalDate(value);
  if (!date) return '';
  return toLocalIsoDate(date);
}
