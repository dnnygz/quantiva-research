/** Figure upload helpers: magic-byte sniffing and dimension parsing (no client MIME trust). */
import { FIGURE_MAX_BYTES } from '@qa/shared';

export type ImageKind = { mime: 'image/png' | 'image/jpeg' | 'image/webp'; ext: 'png' | 'jpg' | 'webp' };

export interface ImageInfo extends ImageKind {
  width: number | null;
  height: number | null;
}

export { FIGURE_MAX_BYTES };

const be16 = (b: Uint8Array, i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const be32 = (b: Uint8Array, i: number) => (be16(b, i) * 65536 + be16(b, i + 2)) >>> 0;
const le16 = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const le24 = (b: Uint8Array, i: number) => le16(b, i) | ((b[i + 2] ?? 0) << 16);
const ascii = (b: Uint8Array, i: number, n: number) =>
  String.fromCharCode(...b.subarray(i, i + n));

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function positive(n: number): number | null {
  return Number.isInteger(n) && n > 0 && n < 1_000_000 ? n : null;
}

function pngSize(b: Uint8Array): [number | null, number | null] {
  if (b.length < 24 || ascii(b, 12, 4) !== 'IHDR') return [null, null];
  return [positive(be32(b, 16)), positive(be32(b, 20))];
}

function jpegSize(b: Uint8Array): [number | null, number | null] {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return [null, null];
    const marker = b[i + 1] ?? 0;
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return [null, null]; // EOI / SOS before SOF
    const isSof =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return [positive(be16(b, i + 7)), positive(be16(b, i + 5))];
    i += 2 + be16(b, i + 2);
  }
  return [null, null];
}

function webpSize(b: Uint8Array): [number | null, number | null] {
  const chunk = ascii(b, 12, 4);
  if (chunk === 'VP8 ' && b.length >= 30) {
    return [positive(le16(b, 26) & 0x3fff), positive(le16(b, 28) & 0x3fff)];
  }
  if (chunk === 'VP8L' && b.length >= 25 && b[20] === 0x2f) {
    const b0 = b[21]!, b1 = b[22]!, b2 = b[23]!, b3 = b[24]!;
    const w = 1 + (((b1 & 0x3f) << 8) | b0);
    const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return [positive(w), positive(h)];
  }
  if (chunk === 'VP8X' && b.length >= 30) {
    return [positive(1 + le24(b, 24)), positive(1 + le24(b, 27))];
  }
  return [null, null];
}

/** Detects PNG / JPEG / WebP from the first bytes. Returns null for anything else. */
export function sniffImage(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length >= 24 && PNG_SIG.every((v, i) => bytes[i] === v)) {
    const [width, height] = pngSize(bytes);
    return { mime: 'image/png', ext: 'png', width, height };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    const [width, height] = jpegSize(bytes);
    return { mime: 'image/jpeg', ext: 'jpg', width, height };
  }
  if (bytes.length >= 16 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    const [width, height] = webpSize(bytes);
    return { mime: 'image/webp', ext: 'webp', width, height };
  }
  return null;
}

export function newStorageKey(ext: string): string {
  return `figures/${crypto.randomUUID()}.${ext}`;
}

export function figureUrl(id: number): string {
  return `/api/figures/${id}/image`;
}
