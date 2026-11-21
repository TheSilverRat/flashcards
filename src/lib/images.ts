import { db, uid } from './db';

const MAX_SIDE = 1400;

/** Resize + re-encode a picked photo so a phone camera shot (~4 MB) becomes ~100-200 KB. */
export async function addImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.82));
  if (!blob || blob.type !== 'image/webp') {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
  }
  if (!blob) throw new Error('Could not process image');

  const id = uid();
  await db.images.add({ id, blob, createdAt: Date.now() });
  return id;
}
