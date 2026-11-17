// Small shared building blocks every view renders with: status dots, badges,
// stat cards and empty states, so the pages look like one product.

import { esc } from './format.js';

/** A live/ended status dot with its word label. */
export function statusDot(b) {
  const live = new Date(b.deadline).getTime() > Date.now();
  return `<span class="dot ${live ? 'dot--live' : 'dot--final'}" aria-hidden="true"></span><span class="dot-label">${live ? 'Live' : 'Final'}</span>`;
}

/** A category pill. */
export function categoryBadge(category) {
  if (!category) return '';
  return `<span class="badge">${esc(category)}</span>`;
}

/** A fee pill: "Free" in its own tone, a dollar amount otherwise. */
export function feeBadge(label, paid) {
  return `<span class="badge ${paid ? 'badge--fee' : 'badge--free'}">${esc(label)}</span>`;
}

/** One headline number on a page: a label over a large value. */
export function stat(label, value, hint = '') {
  return `<div class="stat"><span class="stat__label">${esc(label)}</span><span class="stat__value">${value}</span>${hint ? `<span class="stat__hint">${hint}</span>` : ''}</div>`;
}

/** A designed empty state: an icon, a title and a hint line. */
export function emptyState(title, hint) {
  return `<div class="empty"><div class="empty__mark" aria-hidden="true">◇</div><p class="empty__title">${esc(title)}</p><p class="empty__hint">${esc(hint)}</p></div>`;
}
