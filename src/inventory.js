// Pure functions over inventory items. No DOM, no storage: easy to test.

import { addDays, daysBetween } from './dates.js';
import { guess, freezerDays, thawDays } from './shelfLife.js';

/**
 * @typedef {Object} Item
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {string} category
 * @property {'fridge'|'pantry'|'freezer'} location
 * @property {string} quantity     free text: "2", "half a bag", "500 g"
 * @property {string} addedOn      YYYY-MM-DD
 * @property {string} expiresOn    YYYY-MM-DD
 * @property {'estimate'|'label'} expirySource
 * @property {string} [frozenOn]   YYYY-MM-DD, set while in the freezer
 */

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Create an item from what the person typed.
 * @param {{name: string, location?: string, quantity?: string, expiresOn?: string}} input
 * @param {string} today YYYY-MM-DD
 * @returns {Item}
 */
export function createItem({ name, location, quantity = '', expiresOn }, today) {
  let cleanName = name.trim().replace(/\s+/g, ' ');
  // "2 lemons" -> name "Lemons", quantity "2"
  const counted = cleanName.match(/^(\d+(?:[.,]\d+)?(?:\s?(?:x|g|kg|ml|l|lb|lbs|oz))?)\s+(.+)$/i);
  if (counted && !quantity.trim()) {
    quantity = counted[1];
    cleanName = counted[2];
  }
  cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
  const info = guess(cleanName, location);
  return {
    id: newId(),
    name: cleanName,
    emoji: info.emoji,
    category: info.category,
    location: info.location,
    quantity: quantity.trim(),
    addedOn: today,
    expiresOn: expiresOn || addDays(today, info.days),
    expirySource: expiresOn ? 'label' : 'estimate',
    ...(info.location === 'freezer' ? { frozenOn: today } : {}),
  };
}

/** Split "milk, 2 avocados\nspinach" into separate names. */
export function parseList(text) {
  return text
    .split(/[\n,;]+/)
    .map((part) => part.replace(/^[-*•\s]+/, '').trim())
    .filter(Boolean);
}

/** Move an item into the freezer: shelf life restarts at freezer quality. */
export function freeze(item, today) {
  return {
    ...item,
    location: 'freezer',
    frozenOn: today,
    previousExpiresOn: item.expiresOn,
    expiresOn: addDays(today, freezerDays(item.name)),
    expirySource: 'estimate',
  };
}

/** Take an item out of the freezer to thaw in the fridge. */
export function thaw(item, today) {
  const { frozenOn, previousExpiresOn, ...rest } = item;
  return {
    ...rest,
    location: 'fridge',
    expiresOn: addDays(today, thawDays(item.category)),
    expirySource: 'estimate',
  };
}

/**
 * How urgent an item is.
 *   expired  past its date
 *   today    use today
 *   soon     1-2 days
 *   week     3-6 days
 *   fresh    a week or more
 *   frozen   in the freezer and still at best quality
 */
export function status(item, today) {
  const days = daysBetween(today, item.expiresOn);
  if (days < 0) return { key: 'expired', days };
  if (item.location === 'freezer') return { key: 'frozen', days };
  if (days === 0) return { key: 'today', days };
  if (days <= 2) return { key: 'soon', days };
  if (days <= 6) return { key: 'week', days };
  return { key: 'fresh', days };
}

/**
 * How much of its life an item has left, 0..1. Drives the freshness meter.
 */
export function freshness(item, today) {
  const start = item.frozenOn ?? item.addedOn;
  const total = Math.max(1, daysBetween(start, item.expiresOn));
  const left = daysBetween(today, item.expiresOn);
  return Math.min(1, Math.max(0, left / total));
}

export const GROUPS = [
  { key: 'expired', title: 'Past its date', hint: 'Check these before eating.' },
  { key: 'today', title: 'Use today' },
  { key: 'soon', title: 'Use in the next couple of days' },
  { key: 'week', title: 'Use this week' },
  { key: 'fresh', title: 'Plenty of time' },
  { key: 'frozen', title: 'In the freezer' },
];

/** Sort and bucket items by urgency for the kitchen view. */
export function groupItems(items, today) {
  const buckets = new Map(GROUPS.map((g) => [g.key, []]));
  const sorted = [...items].sort((a, b) => a.expiresOn.localeCompare(b.expiresOn) || a.name.localeCompare(b.name));
  for (const item of sorted) buckets.get(status(item, today).key).push(item);
  return GROUPS.map((g) => ({ ...g, items: buckets.get(g.key) })).filter((g) => g.items.length);
}

/** Items to cook with first: not frozen, ordered by expiry. */
export function useSoon(items, today, withinDays = 2) {
  return items
    .filter((item) => item.location !== 'freezer')
    .filter((item) => {
      const days = daysBetween(today, item.expiresOn);
      return days >= 0 && days <= withinDays;
    })
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
}
