// The bounty board: a two-pane page. The left pane lists the open bounties
// (search, sort chips, category and fee filters), the right pane previews one
// bounty — the soonest-closing live one until a row is picked.

import {
  esc, money, num, ordinal, potUsd, potNumber, feeLabel, hasFee, isLive, timeLeft, dollarPerHour, rewardsOf,
} from './format.js';
import { statusDot, categoryBadge, feeBadge, emptyState } from './ui.js';

const SORTS = [
  { id: 'soon', label: 'Closing soon' },
  { id: 'pot', label: 'Biggest pot' },
  { id: 'entries', label: 'Most entries' },
];

const soonest = (b) => new Date(b.deadline).getTime();

/** Whether a bounty matches the active search and filters. */
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

/** The sort order for the board, live bounties (soonest first) ahead of ended ones. */
function compare(a, b, sort) {
  if (sort === 'pot') return potNumber(b) - potNumber(a) || soonest(a) - soonest(b);
  if (sort === 'entries') return (Number(b.submissionCount) - Number(a.submissionCount)) || soonest(a) - soonest(b);
  const al = isLive(a);
  const bl = isLive(b);
  if (al !== bl) return al ? -1 : 1;
  if (al) return soonest(a) - soonest(b);
  return soonest(b) - soonest(a);
}

/** The bounty the detail pane opens on: the soonest-closing live one, else the soonest. */
export function featuredBounty(items) {
  const live = items.filter(isLive).sort((a, b) => soonest(a) - soonest(b));
  if (live.length > 0) return live[0];
  return [...items].sort((a, b) => soonest(a) - soonest(b))[0] ?? null;
}

/** A short, readable rewards summary for the detail pane. */
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

/** The board page as HTML: list on the left, a filled detail pane on the right. */
export function board(data) {
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

/** Wire the board's search, sort chips, filters and row selection. */
export function bindBoard(app, data) {
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
