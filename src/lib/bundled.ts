import { createEmptyCard } from 'ts-fsrs';
import { db, type Card } from './db';

/**
 * Decks written as Markdown files in the repo's `decks/` folder are built into the app.
 * On every launch they're synced into the on-device database:
 *  - new cards are added, edited cards are updated (review progress is kept),
 *  - cards removed from a file are removed from the app.
 * Cards you add on the phone to these decks are left alone.
 *
 * File format (see README):
 *   # Deck name
 *   Q: question (may span several lines)
 *   A: answer (until the next Q:)
 */

const deckFiles = import.meta.glob('/decks/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<
  string,
  string
>;
const deckImages = import.meta.glob('/decks/**/*.{png,jpg,jpeg,webp,gif,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export interface ParsedDeck {
  slug: string;
  file: string;
  name: string;
  cards: { front: string; back: string }[];
}

export function parseDeck(text: string, path: string): ParsedDeck {
  const file = path.split('/').pop()!;
  const slug = file.replace(/\.md$/i, '');
  let name = slug.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

  const cards: { front: string[]; back: string[] }[] = [];
  let cur: { front: string[]; back: string[] } | null = null;
  let side: 'front' | 'back' = 'front';

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    const title = /^#\s+(.+)$/.exec(line);
    if (title && !cur && !cards.length) {
      name = title[1].trim();
      continue;
    }
    const q = /^Q:\s?(.*)$/.exec(line);
    if (q) {
      if (cur) cards.push(cur);
      cur = { front: [q[1]], back: [] };
      side = 'front';
      continue;
    }
    const a = /^A:\s?(.*)$/.exec(line);
    if (a && cur && side === 'front') {
      cur.back.push(a[1]);
      side = 'back';
      continue;
    }
    // Text before the first Q: is ignored, so you can keep notes at the top of a file.
    if (cur) cur[side].push(line);
  }
  if (cur) cards.push(cur);

  return {
    slug,
    file,
    name,
    cards: cards
      .map((c) => ({ front: resolveImages(c.front.join('\n').trim()), back: resolveImages(c.back.join('\n').trim()) }))
      .filter((c) => c.front),
  };
}

/** `![](images/x.png)` in a deck file → the built image URL. */
function resolveImages(text: string): string {
  return text.replace(/(!\[[^\]]*\]\()\s*(?:\.\/)?([^)\s]+)\s*\)/g, (m, open, src) => {
    if (/^(https?:|data:|img:)/.test(src)) return m;
    const url = deckImages[`/decks/${src}`];
    return url ? `${open}${url})` : m;
  });
}

/** Small stable string hash (cyrb53) → base36. */
function hash(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * A card's identity is its deck file + question text, so fixing a typo in an answer keeps your
 * progress, while rewriting the question makes it a new card.
 */
function cardIds(slug: string, cards: { front: string }[]): string[] {
  const seen = new Map<string, number>();
  return cards.map((c) => {
    const base = hash(c.front.replace(/\s+/g, ' ').trim());
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `b:${slug}:${base}${n ? `-${n}` : ''}`;
  });
}

export function bundledDecks(): ParsedDeck[] {
  return Object.entries(deckFiles)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, text]) => parseDeck(text, path));
}

/** Early test builds created a built-in Welcome deck; it now comes from decks/welcome.md instead. */
async function removeLegacySeedDeck() {
  if (!(await db.meta.get('seeded'))) return;
  await db.transaction('rw', db.decks, db.cards, db.reviews, db.meta, async () => {
    const old = (await db.decks.toArray()).filter((d) => !d.source && d.name === 'Welcome — how it works');
    for (const d of old) {
      await db.cards.where('deckId').equals(d.id).delete();
      await db.reviews.where('deckId').equals(d.id).delete();
      await db.decks.delete(d.id);
    }
    await db.meta.delete('seeded');
  });
}

export async function syncBundledDecks(decks: ParsedDeck[] = bundledDecks()) {
  await removeLegacySeedDeck();
  const stats = { added: 0, updated: 0, removed: 0 };
  const now = Date.now();

  await db.transaction('rw', db.decks, db.cards, db.reviews, async () => {
    const keep = new Set<string>();

    for (const [i, d] of decks.entries()) {
      const deckId = `bundled:${d.slug}`;
      keep.add(deckId);
      const existing = await db.decks.get(deckId);
      if (!existing) {
        // createdAt = file order, so bundled decks list first, alphabetically.
        await db.decks.add({ id: deckId, name: d.name, createdAt: i, updatedAt: now, source: 'bundled', file: d.file });
      } else if (existing.name !== d.name || existing.source !== 'bundled' || existing.createdAt !== i) {
        // createdAt doubles as the sort position, so refresh it when files are added or renamed.
        await db.decks.update(deckId, { name: d.name, source: 'bundled', file: d.file, createdAt: i, updatedAt: now });
      }

      const current = await db.cards.where('deckId').equals(deckId).toArray();
      const byId = new Map(current.map((c) => [c.id, c]));
      const ids = cardIds(d.slug, d.cards);
      const add: Card[] = [];
      const update: Card[] = [];

      d.cards.forEach((c, idx) => {
        const old = byId.get(ids[idx]);
        if (!old) {
          const srs = createEmptyCard(new Date(now));
          // createdAt follows file order, which is the order new cards are introduced in.
          add.push({ id: ids[idx], deckId, front: c.front, back: c.back, srs, due: srs.due.getTime(), createdAt: now + idx, updatedAt: now });
        } else if (old.front !== c.front || old.back !== c.back) {
          update.push({ ...old, front: c.front, back: c.back, updatedAt: now });
        }
      });

      const wanted = new Set(ids);
      const remove = current.filter((c) => c.id.startsWith('b:') && !wanted.has(c.id)).map((c) => c.id);

      if (add.length) await db.cards.bulkAdd(add);
      if (update.length) await db.cards.bulkPut(update);
      if (remove.length) {
        await db.cards.bulkDelete(remove);
        await db.reviews.where('cardId').anyOf(remove).delete();
      }
      stats.added += add.length;
      stats.updated += update.length;
      stats.removed += remove.length;
    }

    // Deck files that were deleted: remove their cards; keep the deck only if you added cards on the phone.
    const gone = (await db.decks.toArray()).filter((d) => d.source === 'bundled' && !keep.has(d.id));
    for (const d of gone) {
      const cards = await db.cards.where('deckId').equals(d.id).toArray();
      const bundled = cards.filter((c) => c.id.startsWith('b:')).map((c) => c.id);
      await db.cards.bulkDelete(bundled);
      await db.reviews.where('cardId').anyOf(bundled).delete();
      stats.removed += bundled.length;
      if (cards.length === bundled.length) await db.decks.delete(d.id);
      else await db.decks.update(d.id, { source: undefined, file: undefined });
    }
  });

  return stats;
}
