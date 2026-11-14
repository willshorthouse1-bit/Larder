// Small DOM helpers shared by the views.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escape text for safe insertion into HTML. */
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

/** Tagged template that escapes interpolations unless they are wrapped with raw(). */
export function html(strings, ...values) {
  return strings.reduce((out, str, i) => {
    if (i >= values.length) return out + str;
    const value = values[i];
    const rendered = Array.isArray(value)
      ? value.map((v) => (v && v.__raw ? v.__raw : esc(v))).join('')
      : value && value.__raw !== undefined
        ? value.__raw
        : value === false || value == null
          ? ''
          : esc(value);
    return out + str + rendered;
  }, '');
}

/** Mark a string of already-safe HTML. */
export const raw = (markup) => ({ __raw: markup });

export const $ = (selector, root = document) => root.querySelector(selector);

/** Join names the way people say them: "a", "a and b", "a, b and c". */
export function listNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

let toastTimer;
/** Brief confirmation at the bottom of the screen, with an optional undo. */
export function toast(message, { action, onAction } = {}) {
  const el = $('#toast');
  el.innerHTML = html`<span>${message}</span>${action ? raw(html`<button type="button" class="toast-action">${action}</button>`) : ''}`;
  // A popover sits in the top layer, so the toast shows above open sheets too.
  const canPop = typeof el.showPopover === 'function';
  const hide = () => (canPop ? el.matches(':popover-open') && el.hidePopover() : (el.hidden = true));
  hide();
  el.hidden = false;
  if (canPop) el.showPopover();
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  if (onAction) $('.toast-action', el).addEventListener('click', () => {
    onAction();
    hide();
  }, { once: true });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, 5000);
}

export const LOCATION_LABELS = { fridge: 'Fridge', pantry: 'Pantry', freezer: 'Freezer' };
