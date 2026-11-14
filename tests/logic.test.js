import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addDays, daysBetween, friendlyDate } from '../src/dates.js';
import { lookup, guess } from '../src/shelfLife.js';
import { createItem, freeze, thaw, status, freshness, groupItems, useSoon, parseList } from '../src/inventory.js';
import { buildPrompt, parseRecipes, suggestRecipes } from '../src/recipes.js';

const TODAY = '2026-11-14'; // a Saturday

test('date math crosses month and year boundaries', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(daysBetween('2026-11-14', '2026-11-21'), 7);
  assert.equal(daysBetween('2026-11-14', '2026-11-10'), -4);
});

test('friendly dates read naturally', () => {
  assert.equal(friendlyDate('2026-11-14', TODAY), 'today');
  assert.equal(friendlyDate('2026-11-15', TODAY), 'tomorrow');
  assert.equal(friendlyDate('2026-11-17', TODAY), 'Tuesday');
  assert.equal(friendlyDate('2026-12-01', TODAY), 'Dec 1');
});

test('lookup prefers the most specific keyword', () => {
  assert.equal(lookup('Ground beef').category, 'meat');
  assert.equal(lookup('ground beef').days.fridge, 2);
  assert.equal(lookup('sour cream').days.fridge, 14);
  assert.equal(lookup('Organic baby spinach').emoji, '🥬');
  assert.equal(lookup('Crème fraîche').category, 'dairy');
  assert.equal(lookup('xyzzy'), null);
});

test('guess falls back sensibly for unknown or unusual locations', () => {
  const unknown = guess('dragon fruit jam thing', 'pantry');
  assert.equal(unknown.location, 'pantry');
  assert.equal(guess('mystery', undefined).location, 'fridge');
  assert.equal(guess('mystery', undefined).known, false);
  // Bananas live in the pantry by default
  assert.equal(guess('bananas').location, 'pantry');
  // Bananas forced into the fridge still get a sane number
  assert.ok(guess('bananas', 'fridge').days > 0);
});

test('createItem estimates expiry, or uses the label date', () => {
  const milk = createItem({ name: '  Milk ' }, TODAY);
  assert.equal(milk.name, 'Milk');
  assert.equal(milk.location, 'fridge');
  assert.equal(milk.expiresOn, '2026-11-21');
  assert.equal(milk.expirySource, 'estimate');

  const lemons = createItem({ name: '2 lemons' }, TODAY);
  assert.equal(lemons.name, 'Lemons');
  assert.equal(lemons.quantity, '2');
  assert.equal(createItem({ name: '500g mince' }, TODAY).quantity, '500g');

  const yogurt = createItem({ name: 'Yogurt', expiresOn: '2026-11-30' }, TODAY);
  assert.equal(yogurt.expiresOn, '2026-11-30');
  assert.equal(yogurt.expirySource, 'label');
});

test('parseList splits pasted shopping lists', () => {
  assert.deepEqual(parseList('milk, eggs\n- spinach\n• 2 lemons;;'), ['milk', 'eggs', 'spinach', '2 lemons']);
});

test('freezing extends the date and thawing shortens it', () => {
  const chicken = createItem({ name: 'Chicken thighs' }, TODAY);
  assert.equal(status(chicken, TODAY).key, 'soon');

  const frozen = freeze(chicken, TODAY);
  assert.equal(frozen.location, 'freezer');
  assert.equal(frozen.frozenOn, TODAY);
  assert.equal(daysBetween(TODAY, frozen.expiresOn), 270);
  assert.equal(status(frozen, TODAY).key, 'frozen');

  const later = '2027-01-10';
  const thawed = thaw(frozen, later);
  assert.equal(thawed.location, 'fridge');
  assert.equal(thawed.frozenOn, undefined);
  assert.equal(thawed.expiresOn, '2027-01-11');
});

test('status buckets by days left', () => {
  const at = (expiresOn, location = 'fridge') => status({ expiresOn, location }, TODAY).key;
  assert.equal(at('2026-11-13'), 'expired');
  assert.equal(at('2026-11-14'), 'today');
  assert.equal(at('2026-11-16'), 'soon');
  assert.equal(at('2026-11-19'), 'week');
  assert.equal(at('2026-11-30'), 'fresh');
  assert.equal(at('2026-11-15', 'freezer'), 'frozen');
  assert.equal(at('2026-11-01', 'freezer'), 'expired');
});

test('freshness is a 0..1 fraction of remaining life', () => {
  assert.equal(freshness({ addedOn: '2026-11-10', expiresOn: '2026-11-18' }, TODAY), 0.5);
  assert.equal(freshness({ addedOn: '2026-11-10', expiresOn: '2026-11-12' }, TODAY), 0);
});

test('groupItems orders by urgency and drops empty groups', () => {
  const items = [
    createItem({ name: 'Rice' }, TODAY),
    createItem({ name: 'Salmon' }, TODAY),
    createItem({ name: 'Peas', location: 'freezer' }, TODAY),
  ];
  const groups = groupItems(items, TODAY);
  assert.deepEqual(groups.map((g) => g.key), ['soon', 'fresh', 'frozen']);
  assert.equal(groups[0].items[0].name, 'Salmon');
});

test('useSoon ignores frozen and expired items', () => {
  const items = [
    { name: 'a', location: 'fridge', expiresOn: '2026-11-15' },
    { name: 'b', location: 'freezer', expiresOn: '2026-11-15' },
    { name: 'c', location: 'fridge', expiresOn: '2026-11-13' },
    { name: 'd', location: 'pantry', expiresOn: '2026-11-14' },
  ];
  assert.deepEqual(useSoon(items, TODAY).map((i) => i.name), ['d', 'a']);
});

test('buildPrompt flags urgent items and states the mode rule', () => {
  const items = [createItem({ name: 'Spinach' }, '2026-11-11'), createItem({ name: 'Rice' }, TODAY)];
  const prompt = buildPrompt(items, { mode: 'shop', today: TODAY, preferences: 'vegetarian' });
  assert.match(prompt, /- Spinach \[fridge, 2d left\] — USE SOON/);
  assert.match(prompt, /1 to 3 ingredients/);
  assert.match(prompt, /vegetarian/);
  assert.ok(prompt.indexOf('Spinach') < prompt.indexOf('Rice'));
});

test('parseRecipes tolerates code fences and cleans fields', () => {
  const reply = '```json\n{"recipes":[{"title":" Frittata ","summary":"Eggy.","minutes":"20","uses":["eggs"],"missing":[],"steps":["Whisk","Bake"]},{"nope":1}]}\n```';
  const [recipe, ...rest] = parseRecipes(reply);
  assert.equal(rest.length, 0);
  assert.equal(recipe.title, 'Frittata');
  assert.equal(recipe.minutes, 20);
  assert.deepEqual(recipe.steps, ['Whisk', 'Bake']);
  assert.throws(() => parseRecipes('sorry, no'), /no recipes/);
});

test('suggestRecipes sends the right request and maps errors', async () => {
  let sent;
  const ok = async (url, init) => {
    sent = { url, init };
    return {
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: '{"recipes":[{"title":"Soup"}]}' }] }),
    };
  };
  const recipes = await suggestRecipes([], { mode: 'cook', today: TODAY }, { apiKey: 'k', fetchImpl: ok });
  assert.equal(recipes[0].title, 'Soup');
  assert.equal(sent.init.headers['x-api-key'], 'k');
  assert.equal(sent.init.headers['anthropic-dangerous-direct-browser-access'], 'true');

  const unauthorized = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(
    suggestRecipes([], { mode: 'cook', today: TODAY }, { apiKey: 'bad', fetchImpl: unauthorized }),
    /not accepted/,
  );
  await assert.rejects(suggestRecipes([], { mode: 'cook', today: TODAY }, {}), /API key/);
});
