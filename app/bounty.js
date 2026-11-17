import { get, esc, money, num, ordinal, potUsd, feeLabel, hasFee, isLive, timeLeft, rewardsOf, statusDot, categoryBadge, feeBadge, emptyState } from './main.js';
import { rankRows, getLeaderboard } from './leaderboard.js';

let css;
function ensureCss() {
  if (!css) css = new Promise((ok) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'pages.css';
    l.onload = ok;
    l.onerror = ok;
    document.head.appendChild(l);
  });
  return css;
}

const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

function date(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'Unknown';
  return `${new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

function stat(label, value, hint = '') {
  return `<div class="stat"><span class="stat__label">${esc(label)}</span><span class="stat__value">${value}</span>${hint ? `<span class="stat__hint">${hint}</span>` : ''}</div>`;
}

function rewardTable(b) {
  const { rows, feeShareTotal } = rewardsOf(b);
  if (rows.length === 0) return emptyState('No prizes', 'This bounty has not announced a prize split.');
  const showShare = feeShareTotal > 0;
  return `
    <div class="rewards">
      <div class="rewards__head">
        <h2>Prize split</h2>
        ${showShare ? `<span class="rewards__note">${money(feeShareTotal)} of entry fees is paid out on top of the base prizes</span>` : ''}
      </div>
      <div class="table-wrap"><table class="table">
        <thead>
          <tr>
            <th class="th-rank">Place</th>
            <th class="th-num">Base prize</th>
            ${showShare ? '<th class="th-num">Fee share</th>' : ''}
            <th class="th-num">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td class="td-rank">${ordinal(r.place)}</td>
              <td class="td-num">${money(r.base)}</td>
              ${showShare ? `<td class="td-num">${money(r.feeShare)}</td>` : ''}
              <td class="td-num td-score">${money(r.total)}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
}

function topFive(top) {
  if (top.length === 0) return emptyState('No entries yet', 'Be the first to enter.');
  return `
    <div class="topfive">
      <h2>Top 5 now</h2>
      <ol class="topfive__list">
        ${top.map((r) => `
          <li>
            <span class="topfive__rank">${r.rank}</span>
            <a class="handle" href="#/u/${encodeURIComponent(r.handle)}">${esc(r.handle)}</a>
            <span class="entry-title">${esc(r.title ?? '')}</span>
            <span class="topfive__score">${r.score}</span>
          </li>`).join('')}
      </ol>
    </div>`;
}

export async function render(app, slug) {
  await ensureCss();
  const [b, lb] = await Promise.all([getBounty(slug), getLeaderboard(slug, true)]);
  const top = rankRows(lb, 5);
  const live = isLive(b);

  return {
    title: `${b.title} — make.fun`,
    html: `
      <div class="page">
        <a class="crumb" href="#/">← All bounties</a>
        <header class="page__head">
          <div class="detail__status">${statusDot(b)}<span class="detail__when">${live ? `closes in ${timeLeft(b.deadline)}` : 'entry closed'}</span></div>
          <div class="detail__meta">${categoryBadge(b.category)}${feeBadge(feeLabel(b), hasFee(b))}<span class="detail__sponsor">by ${esc(b.sponsor?.name ?? 'make.fun')}</span></div>
          <h1>${esc(b.title)}</h1>
          ${b.summary ? `<p class="page__summary">${esc(b.summary)}</p>` : ''}
        </header>

        <div class="stats">
          ${stat('Pot', potUsd(b))}
          ${stat('Entries', num(b.submissionCount))}
          ${stat('Entry fee', feeLabel(b))}
          ${stat('Time left', timeLeft(b.deadline))}
        </div>

        <section class="page__section">${rewardTable(b)}</section>

        <section class="page__section">
          <div class="dates">
            <h2>Timeline</h2>
            <dl class="dates__list">
              <div><dt>Published</dt><dd>${date(b.publishedAt)}</dd></div>
              <div><dt>Deadline</dt><dd>${date(b.deadline)}</dd></div>
            </dl>
          </div>
        </section>

        <section class="page__section">
          ${topFive(top)}
          <a class="btn btn--ghost" href="#/leaderboard/${encodeURIComponent(slug)}">Full leaderboard →</a>
        </section>

        <section class="page__section">
          <h2>About this bounty</h2>
          <div class="description">${esc(b.description ?? '')}</div>
        </section>
      </div>`,
  };
}
