import Dexie, { type EntityTable } from 'dexie';
import { createEmptyCard, type Card as SrsCard } from 'ts-fsrs';

export interface Deck {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Set for decks that come from a file in the repo's `decks/` folder. */
  source?: 'bundled';
  /** File name in `decks/`, for bundled decks. */
  file?: string;
  // Study options (Deck → settings). Missing values mean the defaults in deckOptions().
  /** 'basic' = study all cards whenever you like; 'spaced' = FSRS spaced repetition. */
  mode?: StudyMode;
  /** Basic: card order in a session. */
  order?: 'shuffled' | 'ordered';
  /** Basic: cards per session, 0 = all. */
  sessionSize?: number;
  /** Spaced: new cards introduced per day. */
  newPerDay?: number;
  /** Spaced: reviews per day, 0 = no limit. */
  reviewsPerDay?: number;
}

export type StudyMode = 'basic' | 'spaced';

export interface DeckOptions {
  mode: StudyMode;
  order: 'shuffled' | 'ordered';
  sessionSize: number;
  newPerDay: number;
  reviewsPerDay: number;
}

export function deckOptions(d: Deck | undefined): DeckOptions {
  return {
    mode: d?.mode ?? 'basic',
    order: d?.order ?? 'shuffled',
    sessionSize: d?.sessionSize ?? 0,
    newPerDay: d?.newPerDay ?? 20,
    reviewsPerDay: d?.reviewsPerDay ?? 0,
  };
}

export async function setDeckOptions(id: string, opts: Partial<DeckOptions>) {
  await db.decks.update(id, { ...opts, updatedAt: Date.now() });
}

/** Clear a deck's study history: spaced-repetition schedule, missed marks and review log. */
export async function resetDeckProgress(id: string) {
  const now = new Date();
  await db.transaction('rw', db.cards, db.reviews, async () => {
    const cards = await db.cards.where('deckId').equals(id).toArray();
    await db.cards.bulkPut(
      cards.map((c) => {
        const srs = createEmptyCard(now);
        return { ...c, srs, due: srs.due.getTime(), missed: undefined };
      }),
    );
    await db.reviews.where('deckId').equals(id).delete();
  });
}

/** Cards from `decks/*.md` files have ids starting with `b:`; the file is their source of truth. */
export const isBundledCard = (id: string) => id.startsWith('b:');

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  /** FSRS scheduling state (due, stability, difficulty, state, ...). */
  srs: SrsCard;
  /** Copy of srs.due as a timestamp, indexed for fast "what's due" queries. */
  due: number;
  createdAt: number;
  updatedAt: number;
  /** Basic mode: you marked this card "Missed it" the last time you studied it. */
  missed?: boolean;
}

export interface StoredImage {
  id: string;
  blob: Blob;
  createdAt: number;
}

export interface Review {
  id: string;
  cardId: string;
  deckId: string;
  rating: number;
  /** Card state before this review (0 = New). -1 = a basic-mode answer (not scheduled). */
  prevState: number;
  reviewedAt: number;
  durationMs: number;
}

export interface Meta {
  key: string;
  value: unknown;
}

export const db = new Dexie('flashcards') as Dexie & {
  decks: EntityTable<Deck, 'id'>;
  cards: EntityTable<Card, 'id'>;
  images: EntityTable<StoredImage, 'id'>;
  reviews: EntityTable<Review, 'id'>;
  meta: EntityTable<Meta, 'key'>;
};

db.version(1).stores({
  decks: 'id, name, createdAt',
  cards: 'id, deckId, due, createdAt',
  images: 'id',
  reviews: 'id, cardId, deckId, reviewedAt',
  meta: 'key',
});

/** UUID v4. `crypto.randomUUID` only exists on https/localhost, so fall back for plain-http LAN testing. */
export function uid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------- Settings ----------

export interface Settings {
  /** Old global setting; decks now have their own (deckOptions). Kept so stored settings still parse. */
  newPerDay: number;
  /** Target probability of remembering a card when it comes up (FSRS). */
  retention: number;
  haptics: boolean;
}

export const defaultSettings: Settings = { newPerDay: 20, retention: 0.9, haptics: true };

export async function getSettings(): Promise<Settings> {
  const row = await db.meta.get('settings');
  return { ...defaultSettings, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(s: Settings) {
  await db.meta.put({ key: 'settings', value: s });
}

// ---------- Decks ----------

export async function createDeck(name: string): Promise<string> {
  const now = Date.now();
  const id = uid();
  await db.decks.add({ id, name: name.trim() || 'Untitled deck', createdAt: now, updatedAt: now });
  return id;
}

export async function renameDeck(id: string, name: string) {
  await db.decks.update(id, { name: name.trim() || 'Untitled deck', updatedAt: Date.now() });
}

export async function deleteDeck(id: string) {
  await db.transaction('rw', [db.decks, db.cards, db.reviews, db.images], async () => {
    const cards = await db.cards.where('deckId').equals(id).toArray();
    await db.cards.where('deckId').equals(id).delete();
    await db.reviews.where('deckId').equals(id).delete();
    await db.decks.delete(id);
    await deleteUnusedImages(cards.flatMap((c) => imageIds(c.front + c.back)));
  });
}

// ---------- Cards ----------

export async function createCard(deckId: string, front: string, back: string): Promise<string> {
  const now = Date.now();
  const srs = createEmptyCard(new Date(now));
  const id = uid();
  await db.cards.add({ id, deckId, front, back, srs, due: srs.due.getTime(), createdAt: now, updatedAt: now });
  return id;
}

export async function updateCard(id: string, front: string, back: string) {
  const old = await db.cards.get(id);
  await db.cards.update(id, { front, back, updatedAt: Date.now() });
  if (old) await deleteUnusedImages(imageIds(old.front + old.back));
}

export async function deleteCard(id: string) {
  const old = await db.cards.get(id);
  await db.cards.delete(id);
  await db.reviews.where('cardId').equals(id).delete();
  if (old) await deleteUnusedImages(imageIds(old.front + old.back));
}

// ---------- Images ----------

const IMG_RE = /img:([0-9a-f-]{36})/g;

export function imageIds(text: string): string[] {
  return [...text.matchAll(IMG_RE)].map((m) => m[1]);
}

/** Remove images that no card references any more. */
async function deleteUnusedImages(candidates: string[]) {
  if (!candidates.length) return;
  const all = await db.cards.toArray();
  const used = new Set(all.flatMap((c) => imageIds(c.front + c.back)));
  const unused = [...new Set(candidates)].filter((id) => !used.has(id));
  if (unused.length) await db.images.bulkDelete(unused);
}

// ---------- Storage persistence ----------

/** Ask the browser not to evict our data. Installed PWAs on Android usually get this silently. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
