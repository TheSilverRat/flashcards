import { db, type Card, type Deck, type Review, type Meta } from './db';

interface BackupFile {
  app: 'flashcards';
  version: 1;
  exportedAt: string;
  decks: Deck[];
  cards: Card[];
  reviews: Review[];
  meta: Meta[];
  images: { id: string; type: string; data: string; createdAt: number }[];
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(data: string, type: string): Blob {
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Everything — decks, cards, review history, images, settings — in one JSON file. */
export async function createBackup(): Promise<File> {
  const [decks, cards, reviews, meta, images] = await Promise.all([
    db.decks.toArray(),
    db.cards.toArray(),
    db.reviews.toArray(),
    db.meta.toArray(),
    db.images.toArray(),
  ]);
  const backup: BackupFile = {
    app: 'flashcards',
    version: 1,
    exportedAt: new Date().toISOString(),
    decks,
    cards,
    reviews,
    meta: meta.filter((m) => m.key !== 'lastBackup'),
    images: await Promise.all(
      images.map(async (i) => ({ id: i.id, type: i.blob.type, data: await blobToBase64(i.blob), createdAt: i.createdAt })),
    ),
  };
  const date = new Date().toISOString().slice(0, 10);
  return new File([JSON.stringify(backup)], `flashcards-backup-${date}.json`, { type: 'application/json' });
}

export async function markBackedUp() {
  await db.meta.put({ key: 'lastBackup', value: Date.now() });
}

export async function lastBackup(): Promise<number | null> {
  return ((await db.meta.get('lastBackup'))?.value as number | undefined) ?? null;
}

/** Save the backup: Android share sheet (Drive, Files, …) when available, otherwise a download. */
export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = await createBackup();
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Flashcards backup' });
      await markBackedUp();
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  await markBackedUp();
  return 'downloaded';
}

function reviveCard(c: Card): Card {
  const srs = { ...c.srs, due: new Date(c.srs.due) } as Card['srs'];
  if (c.srs.last_review) srs.last_review = new Date(c.srs.last_review);
  return { ...c, srs, due: srs.due.getTime() };
}

/**
 * Restore from a backup file.
 * - 'merge': adds everything; items that already exist (same id) are overwritten by the backup.
 * - 'replace': wipes the current data first.
 */
export async function importBackup(file: File, mode: 'merge' | 'replace') {
  const data = JSON.parse(await file.text()) as BackupFile;
  if (data.app !== 'flashcards' || !Array.isArray(data.cards)) throw new Error('This is not a Flashcards backup file.');

  await db.transaction('rw', [db.decks, db.cards, db.reviews, db.meta, db.images], async () => {
    if (mode === 'replace') {
      await Promise.all([db.decks.clear(), db.cards.clear(), db.reviews.clear(), db.images.clear()]);
    }
    await db.decks.bulkPut(data.decks);
    await db.cards.bulkPut(data.cards.map(reviveCard));
    await db.reviews.bulkPut(data.reviews ?? []);
    await db.meta.bulkPut((data.meta ?? []).filter((m) => m.key !== 'lastBackup'));
    await db.images.bulkPut(
      (data.images ?? []).map((i) => ({ id: i.id, blob: base64ToBlob(i.data, i.type), createdAt: i.createdAt })),
    );
  });
  return { decks: data.decks.length, cards: data.cards.length };
}
