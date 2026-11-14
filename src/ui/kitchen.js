// The main screen: what you have, sorted by what to use first.

import { getState, update } from '../store.js';
import { toISODate, friendlyDate, addDays, daysBetween } from '../dates.js';
import { groupItems, useSoon, status, freshness, createItem, freeze, thaw, parseList } from '../inventory.js';
import { guess } from '../shelfLife.js';
import { html, raw, $, esc, listNames, toast, LOCATION_LABELS } from './util.js';

let filter = 'all';

function headline(items, today) {
  if (!items.length) {
    return {
      title: 'Your kitchen is empty.',
      sub: 'Add what you bought and Larder will tell you what to use first.',
    };
  }
  const soon = useSoon(items, today);
  if (soon.length) {
    const names = soon.map((i) => i.name.toLowerCase());
    const shown = names.length > 3 ? [...names.slice(0, 2), `${names.length - 2} more`] : names;
    const last = soon.at(-1).expiresOn;
    const when = daysBetween(today, last) === 0 ? 'today' : `by ${friendlyDate(last, today)}`;
    return {
      title: `Use the ${listNames(shown)} ${when}.`,
      sub: soon.length === 1 ? 'Everything else can wait.' : 'These go off first.',
      cta: true,
    };
  }
  const expired = items.filter((i) => status(i, today).key === 'expired');
  const next = items
    .filter((i) => i.location !== 'freezer' && daysBetween(today, i.expiresOn) >= 0)
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn))[0];
  return {
    title: expired.length
      ? `Check the ${listNames(expired.slice(0, 2).map((i) => i.name.toLowerCase()))}${expired.length > 2 ? ' and more' : ''}.`
      : 'Nothing needs using in the next couple of days.',
    sub: next ? `Next up: ${next.name.toLowerCase()} on ${friendlyDate(next.expiresOn, today)}.` : 'Everything else is in the freezer.',
  };
}

function daysLabel(item, today) {
  const { key, days } = status(item, today);
  if (key === 'expired') return days === -1 ? 'Expired yesterday' : `Expired ${-days} days ago`;
  if (key === 'frozen') {
    if (days > 60) return `Best by ${friendlyDate(item.expiresOn, today)}`;
    return `${days} days left`;
  }
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

function itemRow(item, today) {
  const st = status(item, today);
  const pct = Math.round(freshness(item, today) * 100);
  return html`
    <li>
      <button type="button" class="item" data-status="${st.key}" data-id="${item.id}">
        <span class="item-emoji" aria-hidden="true">${item.emoji}</span>
        <span class="item-main">
          <span class="item-name">${item.name}</span>
          <span class="item-meta">${[item.quantity, filter === 'all' ? LOCATION_LABELS[item.location] : '']
            .filter(Boolean)
            .join(', ')}</span>
        </span>
        <span class="item-when">
          <span class="item-days">${daysLabel(item, today)}</span>
          <span class="meter" aria-hidden="true"><span style="--fill:${pct}%"></span></span>
        </span>
      </button>
    </li>`;
}

export function renderKitchen(root, params = new URLSearchParams()) {
  if (params.get('add')) {
    history.replaceState(null, '', '#/kitchen');
    queueMicrotask(openAddSheet);
  }
  const { items } = getState();
  const today = toISODate();
  const counts = { all: items.length, fridge: 0, pantry: 0, freezer: 0 };
  items.forEach((i) => counts[i.location]++);
  const visible = filter === 'all' ? items : items.filter((i) => i.location === filter);
  const head = headline(items, today);
  const groups = groupItems(visible, today);

  root.innerHTML = html`
    <header class="hero">
      <p class="wordmark">Larder</p>
      <h1>${head.title}</h1>
      <p class="hero-sub">${head.sub}</p>
      ${head.cta ? raw(`<a class="button button-soft" href="#/recipes?mode=cook">Get recipe ideas for these</a>`) : ''}
    </header>

    ${items.length
      ? raw(html`
        <nav class="filters" aria-label="Filter by location">
          ${['all', 'fridge', 'pantry', 'freezer'].map((key) =>
            raw(html`<button type="button" class="chip" data-filter="${key}" aria-pressed="${filter === key}">
              ${key === 'all' ? 'All' : LOCATION_LABELS[key]} <span class="count">${counts[key]}</span>
            </button>`),
          )}
        </nav>`)
      : ''}

    ${groups.map((group) =>
      raw(html`
        <section class="group" data-group="${group.key}">
          <h2>${group.title}</h2>
          ${group.hint ? raw(html`<p class="group-hint">${group.hint}</p>`) : ''}
          <ul class="items">${group.items.map((item) => raw(itemRow(item, today)))}</ul>
        </section>`),
    )}

    ${items.length && !visible.length
      ? raw(html`<p class="empty">Nothing in the ${filter} yet.</p>`)
      : ''}

    ${!items.length
      ? raw(`<div class="empty-actions">
          <button type="button" class="button" data-action="add">Add groceries</button>
          <button type="button" class="button button-quiet" data-action="demo">Try it with sample food</button>
        </div>`)
      : ''}

    <button type="button" class="fab" data-action="add" aria-label="Add groceries">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      <span>Add</span>
    </button>
  `;

  root.onclick = (event) => {
    const target = event.target.closest('[data-filter], [data-id], [data-action]');
    if (!target) return;
    if (target.dataset.filter) {
      filter = target.dataset.filter;
      renderKitchen(root);
    } else if (target.dataset.id) {
      openItemSheet(target.dataset.id);
    } else if (target.dataset.action === 'add') {
      openAddSheet();
    } else if (target.dataset.action === 'demo') {
      loadDemo();
    }
  };
}

/* ---------- Item sheet ---------- */

function openItemSheet(id) {
  const item = getState().items.find((i) => i.id === id);
  if (!item) return;
  const today = toISODate();
  const dialog = $('#sheet');
  const frozen = item.location === 'freezer';
  const where = { fridge: 'In the fridge', pantry: 'In the pantry', freezer: `In the freezer since ${friendlyDate(item.frozenOn ?? item.addedOn, today)}` }[item.location];

  dialog.innerHTML = html`
    <form method="dialog" class="sheet-body" data-status="${status(item, today).key}">
      <div class="sheet-head">
        <span class="sheet-emoji" aria-hidden="true">${item.emoji}</span>
        <div>
          <h2>${item.name}</h2>
          <p>${where}. ${frozen ? 'Best quality until' : 'Good until'} ${friendlyDate(item.expiresOn, today)}${item.expirySource === 'estimate' ? ' (estimated)' : ''}.</p>
        </div>
      </div>

      <div class="outcome">
        <button type="button" class="button" data-do="used">Used it up</button>
        <button type="button" class="button button-quiet" data-do="tossed">Threw it out</button>
      </div>

      <button type="button" class="button button-frost" data-do="${frozen ? 'thaw' : 'freeze'}">
        ${frozen ? 'Take out to thaw' : 'Move to the freezer'}
      </button>
      ${frozen
        ? raw('<p class="fine">Thawed food goes in the fridge with a short use-by date.</p>')
        : raw('<p class="fine">Freezing pauses the clock. Larder resets the date to how long it keeps frozen.</p>')}

      <fieldset class="edit">
        <legend>Details</legend>
        <label>Quantity <input name="quantity" value="${item.quantity}" placeholder="e.g. 2, half a bag" autocomplete="off"></label>
        <label>Use by <input type="date" name="expiresOn" value="${item.expiresOn}"></label>
        ${!frozen
          ? raw(html`<label>Kept in
              <select name="location">
                ${['fridge', 'pantry'].map((loc) => raw(html`<option value="${loc}" ${loc === item.location ? 'selected' : ''}>${LOCATION_LABELS[loc]}</option>`))}
              </select></label>`)
          : ''}
      </fieldset>

      <div class="sheet-foot">
        <button type="button" class="link danger" data-do="delete">Remove without logging</button>
        <button type="submit" class="button" data-do="save">Save</button>
      </div>
    </form>`;

  dialog.onclick = (event) => {
    if (event.target === dialog) return dialog.close();
    const action = event.target.closest('[data-do]')?.dataset.do;
    if (!action || action === 'save') return;
    event.preventDefault();
    act(action, item, today);
    dialog.close();
  };
  dialog.onsubmit = () => {
    const form = new FormData(dialog.querySelector('form'));
    update((s) => {
      const target = s.items.find((i) => i.id === id);
      if (!target) return;
      const newDate = form.get('expiresOn');
      if (newDate && newDate !== target.expiresOn) {
        target.expiresOn = newDate;
        target.expirySource = 'label';
      }
      target.quantity = String(form.get('quantity') ?? '').trim();
      const loc = form.get('location');
      if (loc && loc !== target.location) {
        const moved = guess(target.name, loc);
        target.location = loc;
        if (target.expirySource === 'estimate') target.expiresOn = addDays(target.addedOn, moved.days);
      }
    });
    toast(`Saved ${item.name}`);
  };
  dialog.showModal();
}

function act(action, item, today) {
  const snapshot = getState().items;
  const undo = () => update((s) => {
    s.items = snapshot;
    s.log = s.log.filter((entry) => entry.id !== item.id || entry.on !== today);
  });
  if (action === 'used' || action === 'tossed') {
    update((s) => {
      s.items = s.items.filter((i) => i.id !== item.id);
      s.log.push({ id: item.id, name: item.name, category: item.category, outcome: action, on: today });
    });
    toast(action === 'used' ? `Nice. ${item.name} used up.` : `${item.name} thrown out.`, { action: 'Undo', onAction: undo });
  } else if (action === 'freeze' || action === 'thaw') {
    update((s) => {
      s.items = s.items.map((i) => (i.id === item.id ? (action === 'freeze' ? freeze(i, today) : thaw(i, today)) : i));
    });
    const moved = getState().items.find((i) => i.id === item.id);
    toast(action === 'freeze'
      ? `${item.name} frozen. Best by ${friendlyDate(moved.expiresOn, today)}.`
      : `${item.name} is thawing. Use it by ${friendlyDate(moved.expiresOn, today)}.`, { action: 'Undo', onAction: undo });
  } else if (action === 'delete') {
    update((s) => {
      s.items = s.items.filter((i) => i.id !== item.id);
    });
    toast(`${item.name} removed.`, { action: 'Undo', onAction: undo });
  }
}

/* ---------- Add sheet ---------- */

let addMode = 'one';

export function openAddSheet() {
  const dialog = $('#sheet');
  const today = toISODate();
  dialog.innerHTML = html`
    <div class="sheet-body add">
      <div class="sheet-title">
        <h2>Add groceries</h2>
        <button type="button" class="link" data-close>Done</button>
      </div>
      <div class="segmented" role="tablist">
        <button type="button" role="tab" data-mode="one" aria-selected="${addMode === 'one'}">One at a time</button>
        <button type="button" role="tab" data-mode="list" aria-selected="${addMode === 'list'}">Paste a list</button>
      </div>

      <form class="add-one" ${addMode !== 'one' ? 'hidden' : ''}>
        <label class="big-input">
          <span class="sr-only">What did you buy?</span>
          <input name="name" placeholder="What did you buy?" autocomplete="off" required enterkeyhint="done">
        </label>
        <p class="guess" aria-live="polite">Larder guesses how long things keep. You can always change it.</p>
        <div class="segmented location" role="radiogroup" aria-label="Where it's kept">
          ${['fridge', 'pantry', 'freezer'].map((loc) =>
            raw(html`<label><input type="radio" name="location" value="${loc}" ${loc === 'fridge' ? 'checked' : ''}><span>${LOCATION_LABELS[loc]}</span></label>`),
          )}
        </div>
        <div class="row">
          <label>Quantity <input name="quantity" placeholder="optional" autocomplete="off"></label>
          <label>Date on package <input type="date" name="expiresOn" min="${today}"></label>
        </div>
        <button type="submit" class="button wide">Add</button>
      </form>

      <form class="add-list" ${addMode !== 'list' ? 'hidden' : ''}>
        <label>
          <span class="sr-only">Shopping list</span>
          <textarea name="list" rows="5" placeholder="milk, eggs, spinach, chicken thighs, 2 lemons"></textarea>
        </label>
        <ul class="preview"></ul>
        <button type="submit" class="button wide" disabled>Add items</button>
      </form>
    </div>`;

  const one = $('.add-one', dialog);
  const list = $('.add-list', dialog);
  const nameInput = one.elements.name;
  let locationTouched = false;

  const describe = () => {
    const name = nameInput.value.trim();
    const hint = $('.guess', dialog);
    if (!name) {
      hint.textContent = 'Larder guesses how long things keep. You can always change it.';
      return;
    }
    if (!locationTouched) {
      const natural = guess(name).location;
      one.querySelector(`input[value="${natural}"]`).checked = true;
    }
    const loc = one.elements.location.value;
    const info = guess(name, loc);
    hint.innerHTML = html`<span class="guess-emoji">${info.emoji}</span> ${info.known ? 'Usually keeps' : 'Guessing'} about <strong>${formatDays(info.days)}</strong> in the ${loc}.`;
  };

  nameInput.addEventListener('input', describe);
  one.addEventListener('change', (event) => {
    if (event.target.name === 'location') {
      locationTouched = true;
      describe();
    }
  });

  one.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(one);
    const item = createItem(
      {
        name: data.get('name'),
        location: data.get('location'),
        quantity: data.get('quantity'),
        expiresOn: data.get('expiresOn') || undefined,
      },
      today,
    );
    update((s) => {
      s.items.push(item);
    });
    toast(`Added ${item.name}`);
    one.reset();
    locationTouched = false;
    describe();
    nameInput.focus();
  });

  const parsed = () => parseList(list.elements.list.value).map((name) => ({ name, ...guess(name) }));
  list.elements.list.addEventListener('input', () => {
    const rows = parsed();
    $('.preview', dialog).innerHTML = rows
      .map((r) => html`<li><span>${r.emoji}</span> ${r.name} <em>${LOCATION_LABELS[r.location]}, ${formatDays(r.days)}</em></li>`)
      .join('');
    const submit = $('button[type="submit"]', list);
    submit.disabled = !rows.length;
    submit.textContent = rows.length ? `Add ${rows.length} item${rows.length === 1 ? '' : 's'}` : 'Add items';
  });
  list.addEventListener('submit', (event) => {
    event.preventDefault();
    const rows = parsed();
    if (!rows.length) return;
    update((s) => {
      s.items.push(...rows.map((r) => createItem({ name: r.name }, today)));
    });
    toast(`Added ${rows.length} item${rows.length === 1 ? '' : 's'}`);
    dialog.close();
  });

  dialog.onsubmit = null;
  dialog.onclick = (event) => {
    if (event.target === dialog || event.target.closest('[data-close]')) return dialog.close();
    const mode = event.target.closest('[data-mode]')?.dataset.mode;
    if (mode && mode !== addMode) {
      addMode = mode;
      dialog.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', b.dataset.mode === mode));
      one.hidden = mode !== 'one';
      list.hidden = mode !== 'list';
      (mode === 'one' ? nameInput : list.elements.list).focus();
    }
  };

  dialog.showModal();
  (addMode === 'one' ? nameInput : list.elements.list).focus();
}

function formatDays(days) {
  if (days >= 60) return `${Math.round(days / 30)} months`;
  if (days >= 14) return `${Math.round(days / 7)} weeks`;
  return days === 1 ? '1 day' : `${days} days`;
}

/* ---------- Sample data ---------- */

function loadDemo() {
  const today = toISODate();
  const back = (n) => addDays(today, -n);
  const sample = [
    ['Baby spinach', back(4), 'fridge', '1 bag'],
    ['Salmon fillets', back(1), 'fridge', '2'],
    ['Milk', back(6), 'fridge', ''],
    ['Greek yogurt', back(3), 'fridge', '1 tub'],
    ['Cherry tomatoes', back(2), 'pantry', ''],
    ['Feta', back(2), 'fridge', ''],
    ['Lemons', back(5), 'fridge', '2'],
    ['Eggs', back(3), 'fridge', '10'],
    ['Bananas', back(3), 'pantry', '4'],
    ['Sourdough', back(2), 'pantry', 'half a loaf'],
    ['Rice', back(20), 'pantry', ''],
    ['Garlic', back(10), 'pantry', ''],
    ['Chicken thighs', back(30), 'freezer', '6'],
    ['Frozen peas', back(40), 'freezer', ''],
  ];
  update((s) => {
    s.items = sample.map(([name, added, location, quantity]) => {
      const item = createItem({ name, location, quantity }, added);
      return item;
    });
  });
  toast('Added sample food. Clear it any time in Settings.');
}
