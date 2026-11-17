const API = 'https://make.fun/api';

export const metrics = { requests: 0, cacheHits: 0, bytes: 0 };

export function resetMetrics() {
  metrics.requests = 0;
  metrics.cacheHits = 0;
  metrics.bytes = 0;
}

const etags = new Map();
const bodies = new Map();

export async function get(path) {
  const url = API + path;
  const init = {};
  const etag = etags.get(url);
  if (etag) init.headers = { 'If-None-Match': etag };
  const res = await fetch(url, init);
  metrics.requests += 1;
  if (res.status === 304) {
    metrics.cacheHits += 1;
    return bodies.get(url);
  }
  if (!res.ok) {
    let message = `request failed (${res.status})`;
    try {
      const err = await res.json();
      if (err?.error?.[0]?.message) message = err.error[0].message;
    } catch {}
    throw new Error(message);
  }
  const text = await res.text();
  metrics.bytes += new TextEncoder().encode(text).length;
  const fresh = JSON.parse(text);
  const tag = res.headers.get('etag');
  if (tag) {
    etags.set(url, tag);
    bodies.set(url, fresh);
  }
  return fresh;
}

const getBounties = () => get('/competitions?status=open&activity=times');

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function num(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-US');
}

export function ordinal(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  switch (v % 10) {
    case 1: return `${v}st`;
    case 2: return `${v}nd`;
    case 3: return `${v}rd`;
    default: return `${v}th`;
  }
}

export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0.00';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function potUsd(b) {
  return money(b.potUsd ?? b.rewardAmount);
}

function potNumber(b) {
  const n = Number(b.potUsd ?? b.rewardAmount);
  return Number.isFinite(n) ? n : 0;
}

export function feeLabel(b) {
  const n = Number(b.entryFeeUsd);
  if (!b.entryFeeUsd || !Number.isFinite(n) || n <= 0) return 'Free';
  return money(n);
}

export function hasFee(b) {
  const n = Number(b.entryFeeUsd);
  return Boolean(b.entryFeeUsd) && Number.isFinite(n) && n > 0;
}

function msLeft(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return t - Date.now();
}

export function isLive(b) {
  return msLeft(b.deadline) > 0;
}

export function timeLeft(iso) {
  const ms = msLeft(iso);
  if (ms <= 0) return 'Ended';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function dollarPerHour(b) {
  const pot = potNumber(b);
  const ms = msLeft(b.deadline);
  if (ms <= 0) return null;
  const hours = Math.max(1, ms / 3600000);
  const rate = pot / hours;
  const shown = rate >= 100 ? Math.round(rate).toString() : rate >= 10 ? rate.toFixed(1) : rate.toFixed(2);
  return `$${shown}/h`;
}

export function rewardsOf(b) {
  const rows = [];
  let feeShareTotal = 0;
  if (Array.isArray(b.rewardsNow) && b.rewardsNow.length > 0) {
    for (const r of b.rewardsNow) {
      const base = Number(r.baseUsd ?? 0);
      const feeShare = Number(r.feeShareUsd ?? 0);
      const total = Number(r.amountUsd ?? base + feeShare);
      rows.push({ place: Number(r.place), base, feeShare, total });
      feeShareTotal += feeShare;
    }
  } else {
    const map = b.rewards;
    if (map && typeof map === 'object') {
      const pot = Number(b.potUsd ?? b.rewardAmount ?? 0);
      for (const [place, base] of Object.entries(map)) {
        rows.push({ place: Number(place), base: Number(base), feeShare: 0, total: Number(base) });
      }
      const baseSum = rows.reduce((s, r) => s + r.base, 0);
      feeShareTotal = Math.max(0, pot - baseSum);
    }
  }
  rows.sort((a, b) => a.place - b.place);
  return { rows, feeShareTotal, count: rows.length, pot: potNumber(b) };
}

export function statusDot(b) {
  const live = new Date(b.deadline).getTime() > Date.now();
  return `<span class="dot ${live ? 'dot--live' : 'dot--final'}" aria-hidden="true"></span><span class="dot-label">${live ? 'Live' : 'Final'}</span>`;
}

export function categoryBadge(category) {
  if (!category) return '';
  return `<span class="badge">${esc(category)}</span>`;
}

export function feeBadge(label, paid) {
  return `<span class="badge ${paid ? 'badge--fee' : 'badge--free'}">${esc(label)}</span>`;
}

export function emptyState(title, hint) {
  return `<div class="empty"><div class="empty__mark" aria-hidden="true">◇</div><p class="empty__title">${esc(title)}</p><p class="empty__hint">${esc(hint)}</p></div>`;
}

const SORTS = [
  { id: 'soon', label: 'Closing soon' },
  { id: 'pot', label: 'Biggest pot' },
  { id: 'entries', label: 'Most entries' },
];

const soonest = (b) => new Date(b.deadline).getTime();

function matches(b, state) {
  const q = state.query.trim().toLowerCase();
  if (q) {
    const hay = `${b.title} ${b.category} ${b.sponsor?.name ?? ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (state.category && b.category !== state.category) return false;
  if (state.fee === 'free' && hasFee(b)) return false;
  if (state.fee === 'paid' && !hasFee(b)) return false;
  return true;
}

function compare(a, b, sort) {
  if (sort === 'pot') return potNumber(b) - potNumber(a) || soonest(a) - soonest(b);
  if (sort === 'entries') return (Number(b.submissionCount) - Number(a.submissionCount)) || soonest(a) - soonest(b);
  const al = isLive(a);
  const bl = isLive(b);
  if (al !== bl) return al ? -1 : 1;
  if (al) return soonest(a) - soonest(b);
  return soonest(b) - soonest(a);
}

function featuredBounty(items) {
  const live = items.filter(isLive).sort((a, b) => soonest(a) - soonest(b));
  if (live.length > 0) return live[0];
  return [...items].sort((a, b) => soonest(a) - soonest(b))[0] ?? null;
}

function rewardSummary(b) {
  const { rows, feeShareTotal } = rewardsOf(b);
  const top = rows.slice(0, 5);
  const items = top
    .map((r) => `<span class="reward-chip"><em>${ordinal(r.place)}</em>${money(r.total)}</span>`)
    .join('');
  const more = rows.length > top.length ? `<span class="reward-more">+${rows.length - top.length} more</span>` : '';
  const share = feeShareTotal > 0 ? `<p class="reward-share">Includes ${money(feeShareTotal)} of entry fees.</p>` : '';
  return `<div class="reward-chips">${items}${more}</div>${share}`;
}

function detailPane(b) {
  if (!b) return emptyState('Nothing selected', 'Pick a bounty from the list.');
  const live = isLive(b);
  return `
    <div class="detail__status">${statusDot(b)}<span class="detail__when">${live ? `closes in ${timeLeft(b.deadline)}` : 'entry closed'}</span></div>
    <div class="detail__meta">${categoryBadge(b.category)}${feeBadge(feeLabel(b), hasFee(b))}<span class="detail__sponsor">by ${esc(b.sponsor?.name ?? 'make.fun')}</span></div>
    <h2 class="detail__title">${esc(b.title)}</h2>
    <div class="detail__pot">${potUsd(b)}</div>
    <div class="detail__potlabel">current pot</div>
    <div class="detail__grid">
      <div class="detail__cell"><span class="detail__k">Entry fee</span><span class="detail__v">${feeLabel(b)}</span></div>
      <div class="detail__cell"><span class="detail__k">Entries</span><span class="detail__v">${num(b.submissionCount)}</span></div>
      <div class="detail__cell"><span class="detail__k">Time left</span><span class="detail__v">${timeLeft(b.deadline)}</span></div>
      <div class="detail__cell"><span class="detail__k">$/h</span><span class="detail__v">${dollarPerHour(b) ?? 'n/a'}</span></div>
    </div>
    <div class="detail__rewards">
      <h3 class="detail__h">Reward split</h3>
      ${rewardSummary(b)}
    </div>
    <p class="detail__summary">${esc(b.summary ?? b.description?.slice(0, 220) ?? '')}</p>
    <div class="detail__actions">
      <a class="btn" href="#/bounty/${encodeURIComponent(b.slug)}">View bounty</a>
      <a class="btn btn--ghost" href="#/leaderboard/${encodeURIComponent(b.slug)}">Leaderboard</a>
    </div>`;
}

function rowHtml(b, selected) {
  const live = isLive(b);
  const cls = `row${selected ? ' is-selected' : ''}${live ? '' : ' row--ended'}`;
  return `
    <li class="${cls}" data-slug="${encodeURIComponent(b.slug)}" role="button" tabindex="0">
      <div class="row__main">
        <a class="row__title" href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a>
        <div class="row__badges">${categoryBadge(b.category)}${feeBadge(feeLabel(b), hasFee(b))}</div>
      </div>
      <span class="row__cell row__num">${num(b.submissionCount)}</span>
      <span class="row__cell row__pot">${potUsd(b)}</span>
      <span class="row__cell row__time ${live ? '' : 'muted'}">${live ? timeLeft(b.deadline) : 'Ended'}</span>
      <span class="row__cell row__num">${live ? (dollarPerHour(b) ?? '') : ''}</span>
    </li>`;
}

function controlsHtml(state, categories) {
  const sortChips = SORTS.map((s) => `<button class="chip${state.sort === s.id ? ' is-active' : ''}" data-sort="${s.id}">${s.label}</button>`).join('');
  const catOptions = ['', ...categories].map((c) => `<option value="${esc(c)}"${state.category === c ? ' selected' : ''}>${c === '' ? 'All categories' : esc(c)}</option>`).join('');
  return `
    <div class="controls">
      <div class="controls__row">
        <div class="chips" role="group" aria-label="Sort">${sortChips}</div>
        <div class="controls__filters">
          <label class="field"><span class="visually-hidden">Category</span>
            <select data-category>${catOptions}</select>
          </label>
          <label class="field"><span class="visually-hidden">Entry fee</span>
            <select data-fee>
              <option value="all"${state.fee === 'all' ? ' selected' : ''}>Any fee</option>
              <option value="free"${state.fee === 'free' ? ' selected' : ''}>Free entry</option>
              <option value="paid"${state.fee === 'paid' ? ' selected' : ''}>Paid entry</option>
            </select>
          </label>
        </div>
      </div>
      <div class="controls__row controls__search">
        <label class="search"><span class="visually-hidden">Search</span>
          <input type="search" placeholder="Search bounties…" data-search value="${esc(state.query)}">
        </label>
      </div>
    </div>`;
}

function listHtml(items, state, selectedSlug) {
  if (items.length === 0) {
    return emptyState('No bounties match', 'Try a different search or clear the filters.');
  }
  return `<ul class="rows">${items.map((b) => rowHtml(b, b.slug === selectedSlug)).join('')}</ul>`;
}

function board(data) {
  const items = data.items ?? [];
  const categories = [...new Set(items.map((b) => b.category).filter(Boolean))].sort();
  const state = { sort: 'soon', category: '', fee: 'all', query: '' };
  const featured = featuredBounty(items);
  const visible = items.filter((b) => matches(b, state)).sort((a, b) => compare(a, b, state.sort));
  const liveCount = items.filter(isLive).length;
  return `
    <div class="board">
      <section class="board__list">
        <header class="board__head">
          <div class="board__titleline">
            <h1>Open bounties</h1>
            <span class="board__count">${items.length} bounties · ${liveCount} live</span>
          </div>
          ${controlsHtml(state, categories)}
        </header>
        <div class="cols" aria-hidden="true">
          <span class="cols__title">Bounty</span>
          <span>Entries</span>
          <span>Pot</span>
          <span>Ends</span>
          <span>$ / h</span>
        </div>
        <div class="board__rows">${listHtml(visible, state, featured?.slug)}</div>
      </section>
      <aside class="board__detail">${detailPane(featured)}</aside>
    </div>`;
}

function bindBoard(app, data) {
  const items = data.items ?? [];
  const categories = [...new Set(items.map((b) => b.category).filter(Boolean))].sort();
  const state = { sort: 'soon', category: '', fee: 'all', query: '', selected: featuredBounty(items)?.slug ?? null };

  const listEl = () => app.querySelector('.board__rows');
  const detailEl = () => app.querySelector('.board__detail');

  function renderList() {
    const visible = items.filter((b) => matches(b, state)).sort((a, b) => compare(a, b, state.sort));
    listEl().innerHTML = listHtml(visible, state, state.selected);
  }
  function renderDetail() {
    const b = items.find((x) => x.slug === state.selected) ?? null;
    detailEl().innerHTML = detailPane(b);
    const rows = app.querySelectorAll('.row');
    for (const r of rows) r.classList.toggle('is-selected', r.dataset.slug === state.selected);
  }

  app.querySelector('.chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.sort = chip.dataset.sort;
    for (const c of app.querySelectorAll('.chip')) c.classList.toggle('is-active', c.dataset.sort === state.sort);
    renderList();
  });
  app.querySelector('[data-category]').addEventListener('change', (e) => { state.category = e.target.value; renderList(); });
  app.querySelector('[data-fee]').addEventListener('change', (e) => { state.fee = e.target.value; renderList(); });
  app.querySelector('[data-search]').addEventListener('input', (e) => { state.query = e.target.value; renderList(); });

  app.querySelector('.board__rows').addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (!row) return;
    state.selected = decodeURIComponent(row.dataset.slug);
    renderDetail();
  });
  app.querySelector('.board__rows').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.row');
    if (!row) return;
    e.preventDefault();
    state.selected = decodeURIComponent(row.dataset.slug);
    renderDetail();
  });
}

const app = document.getElementById('app');
const footer = document.getElementById('footer');

const STORAGE = 'makefun-theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE, theme);
  } catch {}
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
