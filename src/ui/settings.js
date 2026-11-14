// Settings: API key, preferences, reminders, your waste record, backups.

import { getState, update, exportData, importData, resetAll } from '../store.js';
import { toISODate } from '../dates.js';
import { DEFAULT_MODEL } from '../recipes.js';
import { html, raw, $, toast } from './util.js';

function monthStats(log, today) {
  const month = today.slice(0, 7);
  const thisMonth = log.filter((entry) => entry.on.startsWith(month));
  const used = thisMonth.filter((e) => e.outcome === 'used').length;
  const tossed = thisMonth.length - used;
  return { used, tossed, rate: thisMonth.length ? Math.round((used / thisMonth.length) * 100) : null };
}

export function renderSettings(root) {
  const { settings, log } = getState();
  const today = toISODate();
  const stats = monthStats(log, today);
  const canNotify = 'Notification' in window;

  root.innerHTML = html`
    <header class="page-head">
      <h1>Settings</h1>
    </header>

    <section class="panel stats" aria-label="This month">
      <h2>This month</h2>
      ${stats.rate === null
        ? raw('<p>When you mark food as used or thrown out, your record shows up here.</p>')
        : raw(html`
          <p class="stat-line"><strong>${stats.rate}%</strong> of the food you finished was eaten, not wasted.</p>
          <div class="bar" role="img" aria-label="${stats.used} used, ${stats.tossed} thrown out">
            <span class="bar-used" style="flex:${stats.used}"></span><span class="bar-tossed" style="flex:${stats.tossed}"></span>
          </div>
          <p class="fine">${stats.used} used up, ${stats.tossed} thrown out.</p>`)}
    </section>

    <form class="panel" data-form="ai">
      <h2>Recipe ideas</h2>
      <label>Anthropic API key
        <input type="password" name="apiKey" value="${settings.apiKey}" placeholder="sk-ant-…" autocomplete="off" spellcheck="false">
      </label>
      <p class="fine">Get one at console.anthropic.com. It is saved only in this browser and sent only to Anthropic, along with your ingredient list, when you ask for recipes.</p>
      <label>Diet and preferences
        <input name="preferences" value="${settings.preferences}" placeholder="e.g. vegetarian, no mushrooms, cooking for two" autocomplete="off">
      </label>
      <label>Model
        <input name="model" value="${settings.model}" placeholder="${DEFAULT_MODEL}" autocomplete="off" spellcheck="false">
      </label>
      <button type="submit" class="button">Save</button>
    </form>

    <section class="panel">
      <h2>Reminders</h2>
      ${canNotify
        ? raw(html`
          <label class="switch">
            <input type="checkbox" name="notify" ${settings.notify && Notification.permission === 'granted' ? 'checked' : ''}>
            <span>Remind me about food that needs using</span>
          </label>
          <p class="fine">Once a day, when you open Larder or it's running in the background, you'll get a notification listing what goes off in the next two days.</p>`)
        : raw('<p class="fine">This browser does not support notifications. Add Larder to your home screen to enable them.</p>')}
    </section>

    <section class="panel">
      <h2>Your data</h2>
      <p class="fine">Everything is stored on this device. Back it up to move it to another phone or browser. Backups leave out your API key.</p>
      <div class="button-row">
        <button type="button" class="button button-quiet" data-do="export">Download backup</button>
        <label class="button button-quiet file-button">Restore backup<input type="file" accept="application/json" data-do="import" hidden></label>
      </div>
      <button type="button" class="link danger" data-do="reset">Delete everything</button>
    </section>

    <p class="colophon">Shelf lives are typical estimates for food stored properly. When in doubt, trust the package date and your nose.</p>
  `;

  $('[data-form="ai"]', root).addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    update((s) => {
      s.settings.apiKey = String(data.get('apiKey')).trim();
      s.settings.preferences = String(data.get('preferences')).trim();
      s.settings.model = String(data.get('model')).trim();
    });
    toast('Settings saved');
  });

  root.onchange = async (event) => {
    const el = event.target;
    if (el.name === 'notify') {
      if (el.checked) {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          el.checked = false;
          toast('Notifications are blocked. Allow them in your browser settings.');
          return;
        }
      }
      update((s) => {
        s.settings.notify = el.checked;
      });
      toast(el.checked ? 'Reminders on' : 'Reminders off');
    } else if (el.dataset.do === 'import' && el.files[0]) {
      try {
        importData(await el.files[0].text());
        toast('Backup restored');
      } catch (error) {
        toast(error.message || 'That file could not be read.');
      }
    }
  };

  root.onclick = (event) => {
    const action = event.target.closest('button[data-do]')?.dataset.do;
    if (action === 'export') {
      const blob = new Blob([exportData()], { type: 'application/json' });
      const link = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `larder-backup-${today}.json`,
      });
      link.click();
      URL.revokeObjectURL(link.href);
    } else if (action === 'reset') {
      if (confirm('Delete all food, saved recipes and settings from this device? This cannot be undone.')) {
        resetAll();
        toast('Everything deleted');
      }
    }
  };
}
