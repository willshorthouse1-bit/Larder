// Recipe ideas from Claude, plus a shelf of recipes you saved.

import { getState, update } from '../store.js';
import { toISODate } from '../dates.js';
import { useSoon, status } from '../inventory.js';
import { suggestRecipes, MODES, DEFAULT_MODEL } from '../recipes.js';
import { html, raw, $, toast } from './util.js';

const session = { mode: 'cook', request: '', results: [], loading: false, error: '' };

function recipeCard(recipe, { saved = false, urgent = new Set() } = {}) {
  const facts = [recipe.minutes && `${recipe.minutes} min`, recipe.servings && `serves ${recipe.servings}`].filter(Boolean);
  return html`
    <article class="recipe">
      <details>
        <summary>
          <h3>${recipe.title}</h3>
          ${recipe.summary ? raw(html`<p>${recipe.summary}</p>`) : ''}
          <p class="recipe-facts">${facts.join(', ')}</p>
          <ul class="tags">
            ${recipe.uses.map((name) => raw(html`<li class="${urgent.has(name.toLowerCase()) ? 'tag urgent' : 'tag'}">${name}</li>`))}
            ${recipe.missing.map((name) => raw(html`<li class="tag missing">+ ${name}</li>`))}
          </ul>
        </summary>
        <ol class="steps">${recipe.steps.map((step) => raw(html`<li>${step}</li>`))}</ol>
      </details>
      <div class="recipe-actions">
        ${recipe.missing.length
          ? raw(html`<button type="button" class="link" data-copy="${recipe.missing.join(', ')}">Copy shopping list</button>`)
          : raw('<span></span>')}
        ${saved
          ? raw(html`<button type="button" class="link danger" data-unsave="${recipe.title}">Remove</button>`)
          : raw(html`<button type="button" class="link" data-save="${recipe.title}">Save</button>`)}
      </div>
    </article>`;
}

export function renderRecipes(root, params) {
  if (params.get('mode') && MODES[params.get('mode')]) session.mode = params.get('mode');
  const { items, savedRecipes, settings } = getState();
  const today = toISODate();
  const usable = items.filter((i) => status(i, today).key !== 'expired');
  const urgent = new Set(useSoon(items, today).map((i) => i.name.toLowerCase()));

  root.innerHTML = html`
    <header class="page-head">
      <h1>What can I make?</h1>
      <p>Ideas built around what you have, starting with what goes off first.</p>
    </header>

    ${!settings.apiKey
      ? raw(`<div class="notice">
          <p>Recipe ideas use Claude with your own Anthropic API key. It stays on this device.</p>
          <a class="button button-soft" href="#/settings">Add your key</a>
        </div>`)
      : ''}

    <form class="ask">
      <div class="segmented" role="radiogroup" aria-label="Ingredients">
        ${Object.entries(MODES).map(([key, mode]) =>
          raw(html`<label><input type="radio" name="mode" value="${key}" ${session.mode === key ? 'checked' : ''}><span>${mode.label}</span></label>`),
        )}
      </div>
      <label class="request">
        <span class="sr-only">Anything in particular?</span>
        <input name="request" value="${session.request}" placeholder="Anything in particular? e.g. quick, one pan, spicy" autocomplete="off">
      </label>
      <button type="submit" class="button wide" ${session.loading || !usable.length ? 'disabled' : ''}>
        ${session.loading ? 'Thinking…' : 'Suggest recipes'}
      </button>
      ${!usable.length ? raw('<p class="fine">Add a few groceries first.</p>') : ''}
    </form>

    ${session.error ? raw(html`<p class="error" role="alert">${session.error}</p>`) : ''}

    <section class="results" aria-live="polite" aria-busy="${session.loading}">
      ${session.loading ? raw('<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>') : ''}
      ${!session.loading ? session.results.map((r) => raw(recipeCard(r, { urgent }))) : ''}
    </section>

    ${savedRecipes.length
      ? raw(html`
        <section class="saved">
          <h2>Saved recipes</h2>
          ${savedRecipes.map((r) => raw(recipeCard(r, { saved: true, urgent })))}
        </section>`)
      : ''}
  `;

  const form = $('.ask', root);
  form.addEventListener('change', () => {
    session.mode = form.elements.mode.value;
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    session.request = form.elements.request.value;
    session.loading = true;
    session.error = '';
    renderRecipes(root, new URLSearchParams());
    try {
      session.results = await suggestRecipes(
        usable,
        { mode: session.mode, today, preferences: settings.preferences, request: session.request },
        { apiKey: settings.apiKey, model: settings.model || DEFAULT_MODEL },
      );
      if (!session.results.length) session.error = 'No recipes came back. Try again or loosen the request.';
    } catch (error) {
      session.error = error.message || 'Something went wrong. Try again.';
    } finally {
      session.loading = false;
      if (location.hash.startsWith('#/recipes')) renderRecipes(root, new URLSearchParams());
    }
  });

  root.onclick = async (event) => {
    const el = event.target.closest('[data-save], [data-unsave], [data-copy]');
    if (!el) return;
    if (el.dataset.save) {
      const recipe = session.results.find((r) => r.title === el.dataset.save);
      update((s) => {
        if (!s.savedRecipes.some((r) => r.title === recipe.title)) s.savedRecipes.unshift({ ...recipe, savedOn: today });
      });
      toast(`Saved ${recipe.title}`);
    } else if (el.dataset.unsave) {
      update((s) => {
        s.savedRecipes = s.savedRecipes.filter((r) => r.title !== el.dataset.unsave);
      });
      toast('Recipe removed');
    } else if (el.dataset.copy) {
      try {
        await navigator.clipboard.writeText(el.dataset.copy);
        toast('Shopping list copied');
      } catch {
        toast(el.dataset.copy);
      }
    }
  };
}

/** Exposed for screenshots and the demo: show recipes without calling the API. */
export function setRecipeResults(results) {
  session.results = results;
}
