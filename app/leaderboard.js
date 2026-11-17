import { get, esc, num, emptyState } from './main.js';

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

export const getLeaderboard = (slug, first = false) =>
  get(`/competitions/${encodeURIComponent(slug)}/leaderboard${first ? '?rows=first' : ''}`);

export function bytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0 B';
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`;
  return `${Math.round(n)} B`;
}

export function entryScore(entry, rankKey) {
  if (entry.values && entry.values[rankKey] !== undefined) return Number(entry.values[rankKey]);
  if (entry.value !== undefined && entry.value !== null) return Number(entry.value);
  return null;
}

export function entrySize(entry, tieKey) {
  if (entry.values && entry.values[tieKey] !== undefined) return Number(entry.values[tieKey]);
  return null;
}

export function scoreDisplay(entry, lb) {
  const source = lb.columns?.[0]?.source ?? '';
  const raw = entryScore(entry, lb.rank_key);
  if (raw === null) return 'n/a';
  if (/win_rate|_micro/.test(source)) return `${((raw / 1e6) * 100).toFixed(1)}%`;
  return num(raw);
}

export function rankRows(lb, count) {
  const list = lb.entries ?? [];
  const out = [];
  for (const e of list.slice(0, count)) {
    out.push({
      rank: Number(e.rank),
      handle: e.handle,
      title: e.title,
      score: scoreDisplay(e, lb),
      scoreRaw: entryScore(e, lb.rank_key),
      size: entrySize(e, lb.tie_break?.key),
      prizeRank: e.prize_rank,
    });
  }
  return out;
}

export function entryTotal(lb) {
  return (lb.entries?.length ?? 0) + (lb.rest?.length ?? 0);
}

export async function render(app, slug) {
  await ensureCss();
  const lb = await getLeaderboard(slug);
  const total = entryTotal(lb);
  const rows = rankRows(lb, 50);
  const sizeKey = lb.tie_break?.key;
  const scoreTitle = lb.columns?.[0]?.title ?? 'Score';
  const sizeTitle = lb.tie_break?.title ?? 'Size';
  const hasSize = sizeKey === 'bytes';

  const body = rows.length === 0
    ? emptyState('No entries yet', 'This bounty has not received a ranked entry.')
    : `<div class="table-wrap"><table class="table">
        <thead>
          <tr>
            <th class="th-rank">#</th>
            <th>Entrant</th>
            <th class="th-num">${esc(scoreTitle)}</th>
            ${hasSize ? `<th class="th-num">${esc(sizeTitle)}</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td class="td-rank">${r.rank}</td>
              <td class="td-entrant">
                <a class="handle" href="#/u/${encodeURIComponent(r.handle)}">${esc(r.handle)}</a>
                ${r.title ? `<span class="entry-title">${esc(r.title)}</span>` : ''}
              </td>
              <td class="td-num td-score">${r.score}</td>
              ${hasSize ? `<td class="td-num">${r.size !== null ? bytes(r.size) : ''}</td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table></div>`;

  return {
    title: `${lb.competition?.title ?? slug} leaderboard — make.fun`,
    html: `
      <div class="page">
        <a class="crumb" href="#/bounty/${encodeURIComponent(slug)}">← Back to bounty</a>
        <header class="page__head">
          <div class="page__titleline">
            <h1>${esc(lb.competition?.title ?? slug)}</h1>
            <span class="board__count">Leaderboard</span>
          </div>
          <p class="page__sub">Top ${rows.length} of ${num(total)} entries${lb.tie_break?.better === 'lower' ? ' · smaller size breaks ties' : ''}</p>
        </header>
        ${body}
      </div>`,
  };
}
