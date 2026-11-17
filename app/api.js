// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
//
// get() keeps an ETag for each URL and revalidates on the next visit, so a
// reload that changes nothing costs a 304 instead of a full JSON body. The
// `metrics` object tallies what a view actually cost so the footer can report
// it honestly: requests made, 304 cache hits, and JSON bytes received.

const API = 'https://make.fun/api';

/** Per-view transfer tallies, reset by the router at the start of each route. */
export const metrics = {
  requests: 0,
  cacheHits: 0,
  bytes: 0,
};

/** Wipe the tallies for the next view. */
export function resetMetrics() {
  metrics.requests = 0;
  metrics.cacheHits = 0;
  metrics.bytes = 0;
}

const etags = new Map();
const bodies = new Map();

/** One JSON GET with ETag revalidation. */
async function get(path) {
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
    } catch {
      /* keep the status message */
    }
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

/** The open bounties: { items: [...] } (activity=times leaves out the activity a board does not show). */
export const getBounties = () => get('/competitions?status=open&activity=times');

/** One bounty, by its slug. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/**
 * A bounty's leaderboard. `first` asks the API for just the first page of full
 * rows plus the compact remainder (enough for a "Top 5 now" strip); the default
 * returns every entry in full, which the leaderboard page needs for its size
 * column. Either answer is cached by ETag.
 */
export const getLeaderboard = (slug, first = false) =>
  get(`/competitions/${encodeURIComponent(slug)}/leaderboard${first ? '?rows=first' : ''}`);

/** An account's public profile, by handle. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
