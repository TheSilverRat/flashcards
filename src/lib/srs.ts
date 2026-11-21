import { fsrs, generatorParameters, Rating, State, type Grade, type FSRS } from 'ts-fsrs';
import { db, uid, type Card, type Review } from './db';

export { Rating, State };
export type { Grade };

export const GRADES: { grade: Grade; label: string; key: string }[] = [
  { grade: Rating.Again, label: 'Again', key: '1' },
  { grade: Rating.Hard, label: 'Hard', key: '2' },
  { grade: Rating.Good, label: 'Good', key: '3' },
  { grade: Rating.Easy, label: 'Easy', key: '4' },
];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Learning cards due within this window are shown now instead of making you wait. */
export const LEARN_AHEAD = 20 * 60_000;

let cached: { retention: number; f: FSRS } | null = null;
export function scheduler(retention = 0.9): FSRS {
  if (!cached || cached.retention !== retention) {
    cached = { retention, f: fsrs(generatorParameters({ enable_fuzz: true, request_retention: retention })) };
  }
  return cached.f;
}

/** A study "day" starts at 4am, like Anki, so late-night sessions count for the previous day. */
export function dayStart(now = Date.now()): number {
  const d = new Date(now);
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  d.setHours(4, 0, 0, 0);
  return d.getTime();
}

export function isDue(card: Card, now = Date.now()): boolean {
  const s = card.srs.state;
  if (s === State.New) return false;
  if (s === State.Review) return card.due < dayStart(now) + DAY;
  return card.due <= now + LEARN_AHEAD;
}

export interface Counts {
  newCount: number;
  learnCount: number;
  reviewCount: number;
  total: number;
}

export function countDue(cards: Card[], newIntroducedToday: number, newPerDay: number, now = Date.now()): Counts {
  let learn = 0, review = 0, fresh = 0;
  for (const c of cards) {
    if (c.srs.state === State.New) fresh++;
    else if (isDue(c, now)) c.srs.state === State.Review ? review++ : learn++;
  }
  const newCount = Math.min(fresh, Math.max(0, newPerDay - newIntroducedToday));
  return { newCount, learnCount: learn, reviewCount: review, total: newCount + learn + review };
}

/** Learning cards first, then reviews, with new cards spread evenly through the reviews. */
export function buildQueue(cards: Card[], newLimit: number, now = Date.now()): Card[] {
  const learning = cards.filter((c) => c.srs.state !== State.New && c.srs.state !== State.Review && isDue(c, now));
  const reviews = cards.filter((c) => c.srs.state === State.Review && isDue(c, now));
  const fresh = cards
    .filter((c) => c.srs.state === State.New)
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, Math.max(0, newLimit));
  learning.sort((a, b) => a.due - b.due);
  reviews.sort((a, b) => a.due - b.due);

  const mixed: Card[] = [];
  const step = fresh.length ? (reviews.length + fresh.length) / fresh.length : Infinity;
  let r = 0, n = 0;
  for (let i = 0; r < reviews.length || n < fresh.length; i++) {
    if (n < fresh.length && (r >= reviews.length || i >= (n + 1) * step - 1)) mixed.push(fresh[n++]);
    else mixed.push(reviews[r++]);
  }
  return [...learning, ...mixed];
}

/** Preview the next due date for each grade, for labels on the rating buttons. */
export function previewIntervals(card: Card, retention: number, now = new Date()): Record<number, string> {
  const preview = scheduler(retention).repeat(card.srs, now);
  const out: Record<number, string> = {};
  for (const { grade } of GRADES) out[grade] = formatInterval(preview[grade].card.due.getTime() - now.getTime());
  return out;
}

/** Apply a rating: saves the new schedule and a review-log entry. Returns what's needed to undo. */
export async function rate(card: Card, grade: Grade, retention: number, durationMs: number) {
  const now = new Date();
  const { card: next } = scheduler(retention).next(card.srs, now, grade);
  const updated: Card = { ...card, srs: next, due: next.due.getTime() };
  const review: Review = {
    id: uid(),
    cardId: card.id,
    deckId: card.deckId,
    rating: grade,
    prevState: card.srs.state,
    reviewedAt: now.getTime(),
    durationMs,
  };
  await db.transaction('rw', db.cards, db.reviews, async () => {
    await db.cards.put(updated);
    await db.reviews.add(review);
  });
  return { updated, previous: card, reviewId: review.id };
}

export async function undoRating(previous: Card, reviewId: string) {
  await db.transaction('rw', db.cards, db.reviews, async () => {
    await db.cards.put(previous);
    await db.reviews.delete(reviewId);
  });
}

export function formatInterval(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / 60_000))}m`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`;
  const days = ms / DAY;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1).replace(/\.0$/, '')}y`;
}

/** Consecutive study days ending today (or yesterday, if you haven't studied yet today). */
export function streak(reviewTimes: number[], now = Date.now()): number {
  const days = new Set(reviewTimes.map((t) => dayStart(t)));
  let day = dayStart(now);
  // Step back one day; landing at 9am and snapping to 4am keeps this correct across DST shifts.
  const prev = (d: number) => dayStart(d - DAY + HOUR * 5);
  if (!days.has(day)) day = prev(day);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = prev(day);
  }
  return n;
}
