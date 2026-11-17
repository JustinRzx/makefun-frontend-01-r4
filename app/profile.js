import { get, esc, money, num, ordinal, emptyState } from './main.js';

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

const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);

function dateShort(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'Unknown';
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
}

function stat(label, value, hint = '') {
  return `<div class="stat"><span class="stat__label">${esc(label)}</span><span class="stat__value">${value}</span>${hint ? `<span class="stat__hint">${hint}</span>` : ''}</div>`;
}

function solutionBadge(s) {
  if (s.prize_usd !== null && s.prize_usd !== undefined) return `<span class="badge badge--win">Won ${money(s.prize_usd)}</span>`;
  if (s.placement !== null && s.placement !== undefined) return `<span class="badge">Placed ${ordinal(s.placement)}</span>`;
  if (s.score?.display && s.score.display !== 'n/a') return `<span class="badge badge--neutral">${esc(s.score.display)}</span>`;
  return `<span class="badge badge--neutral">Open</span>`;
}

function solutionsList(solutions) {
  if (!solutions || solutions.length === 0) return emptyState('No entries yet', 'This account has not entered a bounty.');
  return `
    <ul class="solutions">
      ${solutions.map((s) => `
        <li class="solutions__row">
          <div class="solutions__main">
            <a class="solutions__title" href="#/bounty/${encodeURIComponent(s.competition?.slug ?? '')}">${esc(s.title ?? 'Untitled')}</a>
            <span class="solutions__comp">${esc(s.competition?.title ?? '')}</span>
          </div>
          <div class="solutions__side">
            ${solutionBadge(s)}
            <span class="solutions__date">${dateShort(s.entered_at)}</span>
          </div>
        </li>`).join('')}
    </ul>`;
}

export async function render(app, handle) {
  await ensureCss();
  const p = await getProfile(handle);
  const rec = p.record ?? {};
  const initial = (p.handle ?? '?').charAt(0).toUpperCase();

  return {
    title: `@${p.handle} — make.fun`,
    html: `
      <div class="page">
        <a class="crumb" href="#/">← All bounties</a>
        <header class="profile__head">
          <div class="profile__avatar" aria-hidden="true">${esc(initial)}</div>
          <div class="profile__id">
            <h1>@${esc(p.handle)}</h1>
            ${p.display_name ? `<p class="profile__name">${esc(p.display_name)}</p>` : ''}
            ${p.bio ? `<p class="profile__bio">${esc(p.bio)}</p>` : ''}
            <p class="profile__joined">Joined ${dateShort(p.joined_at)}</p>
          </div>
        </header>

        <div class="stats">
          ${stat('Bounties entered', num(rec.competitions_entered ?? 0))}
          ${stat('Won', num(rec.competitions_won ?? 0))}
          ${stat('Placed', num(rec.competitions_placed ?? 0))}
          ${stat('Prize money', money(rec.prize_usd ?? 0))}
        </div>

        <section class="page__section">
          <h2>Entries</h2>
          ${solutionsList(p.solutions)}
        </section>
      </div>`,
  };
}
