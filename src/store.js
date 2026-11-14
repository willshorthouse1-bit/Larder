// Tiny persistent store. Everything lives in this browser's localStorage;
// nothing is sent anywhere except ingredient names when you ask for recipes.

const KEY = 'larder.v1';

const EMPTY = {
  version: 1,
  items: [],
  log: [], // { name, outcome: 'used'|'tossed', on: YYYY-MM-DD }
  savedRecipes: [],
  settings: {
    apiKey: '',
    model: '',
    preferences: '',
    notify: false,
  },
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const data = JSON.parse(raw);
    return { ...structuredClone(EMPTY), ...data, settings: { ...EMPTY.settings, ...data.settings } };
  } catch {
    return structuredClone(EMPTY);
  }
}

let state = read();
const listeners = new Set();

export const getState = () => state;

/** Change state by editing a draft copy (or returning a new object), then save. */
export function update(recipe) {
  const draft = structuredClone(state);
  state = recipe(draft) ?? draft;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Could not save', error);
  }
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A backup file without the API key in it. */
export function exportData() {
  const { settings, ...rest } = state;
  const { apiKey, ...safeSettings } = settings;
  return JSON.stringify({ ...rest, settings: safeSettings, exportedAt: new Date().toISOString() }, null, 2);
}

export function importData(json) {
  const data = JSON.parse(json);
  if (!Array.isArray(data.items)) throw new Error('That file is not a Larder backup.');
  update((s) => ({
    ...s,
    items: data.items,
    log: Array.isArray(data.log) ? data.log : s.log,
    savedRecipes: Array.isArray(data.savedRecipes) ? data.savedRecipes : s.savedRecipes,
    settings: { ...s.settings, ...data.settings, apiKey: s.settings.apiKey },
  }));
}

export function resetAll() {
  update(() => structuredClone(EMPTY));
}
