const STORAGE_KEY = 'clareia_calendar_preferences_v1';

const DEFAULT_PREFERENCES = {
  workDays: [1, 2, 3, 4, 5],
  allowWeekendTasks: false,
  sundayIsRestDay: true
};

function sanitizeWorkDays(value) {
  if (!Array.isArray(value)) return DEFAULT_PREFERENCES.workDays;
  const normalized = Array.from(new Set(value.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a, b) => a - b);
  return normalized.length > 0 ? normalized : DEFAULT_PREFERENCES.workDays;
}

export function getCalendarPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw);
    return {
      workDays: sanitizeWorkDays(parsed?.workDays),
      allowWeekendTasks: parsed?.allowWeekendTasks === true,
      sundayIsRestDay: parsed?.sundayIsRestDay !== false
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function updateCalendarPreferences(partial = {}) {
  const current = getCalendarPreferences();
  const next = {
    workDays: sanitizeWorkDays(partial.workDays ?? current.workDays),
    allowWeekendTasks: partial.allowWeekendTasks ?? current.allowWeekendTasks,
    sundayIsRestDay: partial.sundayIsRestDay ?? current.sundayIsRestDay
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function isPersonalTask(task = {}) {
  const type = String(task?.taskType || '').toLowerCase();
  const project = String(task?.project || '').toLowerCase();
  return type.includes('pessoal') || project.includes('pessoal');
}

export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function shouldAvoidWeekendForTask(task = {}, preferences = getCalendarPreferences()) {
  if (preferences.allowWeekendTasks) return false;
  return !isPersonalTask(task);
}

export function isAllowedDayForTask(date, task = {}, options = {}) {
  const preferences = options.preferences || getCalendarPreferences();
  const manual = options.manual === true;
  const markedManual = manual || task?.manualSchedule === true;

  const day = date.getDay();
  const workDays = sanitizeWorkDays(preferences.workDays);
  if (markedManual) return true;

  if (isWeekend(date)) {
    if (day === 0 && preferences.sundayIsRestDay) return false;
    if (!preferences.allowWeekendTasks && !isPersonalTask(task)) return false;
    return true;
  }

  return workDays.includes(day);
}

export function getDefaultCalendarPreferences() {
  return { ...DEFAULT_PREFERENCES };
}
