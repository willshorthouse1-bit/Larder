// Recipe suggestions from Claude. The prompt builder and response parser are
// pure so they can be unit tested; only `suggestRecipes` touches the network.

import { daysBetween } from './dates.js';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

export const MODES = {
  cook: {
    label: 'Just what I have',
    rule: 'Use ONLY ingredients from the list plus common staples (salt, pepper, oil, water, basic dried spices). "missing" must be an empty array.',
  },
  shop: {
    label: 'Plus a few extras',
    rule: 'Each recipe may add 1 to 3 ingredients that are not on the list. Put those in "missing". Prefer cheap, easy-to-find additions.',
  },
};

/**
 * Build the user prompt. Items closest to expiry are listed first and flagged.
 * @param {import('./inventory.js').Item[]} items
 * @param {{mode: 'cook'|'shop', today: string, preferences?: string, request?: string, count?: number}} options
 */
export function buildPrompt(items, { mode, today, preferences = '', request = '', count = 4 }) {
  const lines = [...items]
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))
    .map((item) => {
      const days = daysBetween(today, item.expiresOn);
      const where = item.location === 'freezer' ? 'frozen' : item.location;
      const urgency = item.location !== 'freezer' && days <= 2 ? ' — USE SOON' : '';
      const qty = item.quantity ? ` (${item.quantity})` : '';
      return `- ${item.name}${qty} [${where}, ${days < 0 ? 'past date' : `${days}d left`}]${urgency}`;
    });

  const guidance = [
    `Rule: ${MODES[mode].rule}`,
    'Prioritise ingredients marked USE SOON. Frozen items are fine but need thawing time.',
    'Skip items past their date.',
    preferences.trim() && `Dietary needs and preferences: ${preferences.trim()}`,
    request.trim() && `What I am in the mood for: ${request.trim()}`,
  ].filter(Boolean);

  const format = [
    'Respond with JSON only, no prose, matching exactly:',
    '{"recipes":[{"title":string,"summary":string (one sentence),"minutes":number,"servings":number,',
    '"uses":string[] (ingredient names from my list, spelled as I wrote them),',
    '"missing":string[],"steps":string[] (short, imperative)}]}',
  ];

  return [
    `Suggest ${count} recipes I can cook at home.`,
    ['My ingredients:', ...(lines.length ? lines : ['- (nothing listed)'])].join('\n'),
    guidance.join('\n'),
    format.join('\n'),
  ].join('\n\n');
}

/** Pull the recipes array out of a model reply, tolerating code fences or stray prose. */
export function parseRecipes(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('The reply had no recipes in it. Try again.');
  let data;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('The reply could not be read. Try again.');
  }
  const list = Array.isArray(data) ? data : data.recipes;
  if (!Array.isArray(list)) throw new Error('The reply had no recipes in it. Try again.');
  return list
    .filter((r) => r && typeof r.title === 'string')
    .map((r) => ({
      title: r.title.trim(),
      summary: String(r.summary ?? '').trim(),
      minutes: Number.isFinite(Number(r.minutes)) ? Number(r.minutes) : null,
      servings: Number.isFinite(Number(r.servings)) ? Number(r.servings) : null,
      uses: toStrings(r.uses),
      missing: toStrings(r.missing),
      steps: toStrings(r.steps),
    }));
}

const toStrings = (value) => (Array.isArray(value) ? value.map(String).map((s) => s.trim()).filter(Boolean) : []);

/**
 * Ask Claude for recipes. The API key is the person's own and stays in their browser.
 * @returns {Promise<ReturnType<typeof parseRecipes>>}
 */
export async function suggestRecipes(items, options, { apiKey, model = DEFAULT_MODEL, fetchImpl = fetch } = {}) {
  if (!apiKey) throw new Error('Add your Anthropic API key in Settings to get recipe ideas.');
  const response = await fetchImpl(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system:
        'You are a practical home cook helping someone use up groceries before they go off. ' +
        'Suggest realistic weeknight recipes. Reply with JSON only.',
      messages: [{ role: 'user', content: buildPrompt(items, options) }],
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.json())?.error?.message ?? '';
    } catch {
      /* ignore */
    }
    if (response.status === 401) throw new Error('Your API key was not accepted. Check it in Settings.');
    if (response.status === 429) throw new Error('Too many requests right now. Wait a minute and try again.');
    throw new Error(`Recipe request failed (${response.status}). ${detail}`.trim());
  }

  const data = await response.json();
  const text = (data.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return parseRecipes(text);
}
