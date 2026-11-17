// Display helpers: every value the API hands us, made safe and made human.
// No view ever prints NaN, "undefined", "Invalid Date" or a bare dash: each
// helper falls back to a real word when the field is missing.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A whole number with thousands separators: 10406 -> "10,406". */
export function num(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-US');
}

/** A number as an ordinal: 1 -> "1st", 22 -> "22nd". */
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

/** A dollar amount, always two decimals: "1000.00" -> "$1,000.00", 0.5 -> "$0.50". */
export function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0.00';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A byte count as a file size: 703173 -> "703 KB", 1087734 -> "1.09 MB". */
export function bytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0 B';
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`;
  return `${Math.round(n)} B`;
}

/** The live pot of a bounty, in dollars: potUsd when present, else the base reward. */
export function potUsd(b) {
  return money(b.potUsd ?? b.rewardAmount);
}

/** A bounty's pot as a number, for sorting and rates. */
export function potNumber(b) {
  const n = Number(b.potUsd ?? b.rewardAmount);
  return Number.isFinite(n) ? n : 0;
}

/** The entry fee label: "Free" for a free bounty, "$0.50" otherwise. */
export function feeLabel(b) {
  const n = Number(b.entryFeeUsd);
  if (!b.entryFeeUsd || !Number.isFinite(n) || n <= 0) return 'Free';
  return money(n);
}

/** Whether a bounty has a paid entry fee. */
export function hasFee(b) {
  const n = Number(b.entryFeeUsd);
  return Boolean(b.entryFeeUsd) && Number.isFinite(n) && n > 0;
}

/** Milliseconds until a deadline, negative when it has passed. */
export function msLeft(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return t - Date.now();
}

/** Whether a deadline is still in the future. */
export function isLive(b) {
  return msLeft(b.deadline) > 0;
}

/** Time until a deadline as tight text: "3d 4h", "2h 11m", "45m", "18s", or "Ended". */
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

/** The value rate of a bounty: its pot per hour still to close (hours floored
 *  at one so a bounty about to end reads as its pot, not a runaway number),
 *  or null when it has ended. */
export function dollarPerHour(b) {
  const pot = potNumber(b);
  const ms = msLeft(b.deadline);
  if (ms <= 0) return null;
  const hours = Math.max(1, ms / 3600000);
  const rate = pot / hours;
  const shown = rate >= 100 ? Math.round(rate).toString() : rate >= 10 ? rate.toFixed(1) : rate.toFixed(2);
  return `$${shown}/h`;
}

/** An ISO instant as a full date and time in UTC. */
export function date(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'Unknown';
  return `${new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** An ISO instant as just the date in UTC. */
export function dateShort(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'Unknown';
  return new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
}

/**
 * A bounty's rewards as a table of { place, base, feeShare, total } rows, from
 * rewardsNow when present; otherwise from the plain rewards map, where the fee
 * share is the pot less the sum of the base prizes.
 */
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
