// Calendar-date helpers. Dates are stored as local "YYYY-MM-DD" strings so an
// item added at 11pm never slips a day when the timezone changes.

const pad = (n) => String(n).padStart(2, '0');

/** @param {Date} [date] */
export function toISODate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toUTC(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso, days) {
  const date = new Date(toUTC(iso) + days * 86_400_000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from, to) {
  return Math.round((toUTC(to) - toUTC(from)) / 86_400_000);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "today", "tomorrow", "Thursday", or "Mar 4" */
export function friendlyDate(iso, today) {
  const diff = daysBetween(today, iso);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  const date = new Date(toUTC(iso));
  if (diff > 1 && diff < 7) return WEEKDAYS[date.getUTCDay()];
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}
