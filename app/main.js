// The make.fun frontend: a hash router over four read-only surfaces, all on
// live data from https://make.fun/api.
//
//   #/                  the bounty board (eager: the only path the first load pulls)
//   #/bounty/<slug>     one bounty
//   #/leaderboard/<slug> that bounty's leaderboard
//   #/u/<handle>        an account's public profile
//
// The board is the eager path; the three other views lazy-load with import()
// so the first paint stays lean. window.__shotReady is false while a view
// loads and true only once its data is rendered, so a screenshot script knows
// when to capture.

import { getBounties, resetMetrics, metrics } from './api.js';
import { board, bindBoard } from './views.js';
import { emptyState } from './ui.js';

const app = document.getElementById('app');
const footer = document.getElementById('footer');

// ---------------------------------------------------------------- theme

const STORAGE = 'makefun-theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE, theme);
  } catch {
    /* private mode: keep the session theme */
  }
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE);
  } catch {
    saved = null;
  }
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
});

// ---------------------------------------------------------------- footer

/** A byte count for the footer's "JSON transferred" figure. */
function sizeText(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`;
  return `${Math.round(n)} B`;
}

function renderFooter(started) {
  const ms = Math.round(performance.now() - started);
  footer.innerHTML =
    `<span>Live data from make.fun</span><span class="footer__dot">·</span>` +
    `<span>${metrics.requests} request${metrics.requests === 1 ? '' : 's'}</span>` +
    `<span>${metrics.cacheHits} cache hit${metrics.cacheHits === 1 ? '' : 's'}</span>` +
    `<span>${sizeText(metrics.bytes)} JSON</span>` +
    `<span>ready in ${ms} ms</span>`;
}

// ---------------------------------------------------------------- router

function parseRoute() {
  const hash = location.hash || '#/';
  const bounty = hash.match(/^#\/bounty\/([^/]+)/);
  if (bounty) return { view: 'bounty', arg: decodeURIComponent(bounty[1]) };
  const leaderboard = hash.match(/^#\/leaderboard\/([^/]+)/);
  if (leaderboard) return { view: 'leaderboard', arg: decodeURIComponent(leaderboard[1]) };
  const profile = hash.match(/^#\/u\/([^/]+)/);
  if (profile) return { view: 'profile', arg: decodeURIComponent(profile[1]) };
  return { view: 'board', arg: null };
}

function errorPage(message) {
  return emptyState('Could not load this page', message);
}

async function render() {
  window.__shotReady = false;
  resetMetrics();
  const started = performance.now();
  const { view, arg } = parseRoute();

  let html = '';
  let mount = null;
  let title = 'make.fun — the bounty board';

  try {
    if (view === 'board') {
      const data = await getBounties();
      html = board(data);
      mount = (el) => bindBoard(el, data);
      title = 'make.fun — the bounty board';
    } else if (view === 'bounty') {
      const mod = await import('./bounty.js');
      const out = await mod.render(app, arg);
      html = out.html;
      title = out.title;
    } else if (view === 'leaderboard') {
      const mod = await import('./leaderboard.js');
      const out = await mod.render(app, arg);
      html = out.html;
      title = out.title;
    } else {
      const mod = await import('./profile.js');
      const out = await mod.render(app, arg);
      html = out.html;
      title = out.title;
    }
  } catch (err) {
    html = errorPage(err?.message ?? 'Please try again.');
    title = 'make.fun — the bounty board';
  }

  document.title = title;
  app.innerHTML = html;
  if (mount) mount(app);
  window.scrollTo(0, 0);
  renderFooter(started);
  window.__shotReady = true;
}

window.addEventListener('hashchange', render);
initTheme();
render();
