import fs from 'fs/promises';
import path from 'path';
import type { Drawing, DrawingStorageKind, SavedDrawing } from '../generated/prisma';
import { getNumberEnv } from '../config/env';
import { logError } from '../utils/logger';

const DEFAULT_INLINE_MAX_BYTES = 65536;

function getStorageRoot(): string {
  return process.env.DRAWINGS_STORAGE_PATH || path.join(process.cwd(), 'data', 'drawings');
}

function assertSafeRelativeKey(key: string): void {
  if (!key || key.includes('..') || path.isAbsolute(key)) {
    throw new Error('INVALID_STORAGE_KEY');
  }
}

function toAbsoluteKey(relativeKey: string): string {
  assertSafeRelativeKey(relativeKey);
  const root = path.resolve(getStorageRoot());
  const abs = path.resolve(root, relativeKey);
  if (!abs.startsWith(root + path.sep) && abs !== root) {
    throw new Error('INVALID_STORAGE_KEY');
  }
  return abs;
}

export async function writeDrawingBlob(relativeKey: string, utf8Payload: string): Promise<void> {
  const abs = toAbsoluteKey(relativeKey);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, utf8Payload, 'utf8');
}

export async function readDrawingBlob(relativeKey: string): Promise<string> {
  const abs = toAbsoluteKey(relativeKey);
  return fs.readFile(abs, 'utf8');
}

export function getInlineMaxBytes(): number {
  return getNumberEnv('DRAWING_INLINE_MAX_BYTES', DEFAULT_INLINE_MAX_BYTES);
}

export type PersistedDrawingPayload = {
  storageKind: DrawingStorageKind;
  drawingData: string | null;
  storageKey: string | null;
  byteLength: number;
};

/**
 * Decide inline vs file-backed storage. Large payloads go to LOCAL_FILE so Postgres stays a pointer + metadata.
 */
export async function persistGameDrawingPayload(
  flipbookId: string,
  drawingId: string,
  utf8Payload: string
): Promise<PersistedDrawingPayload> {
  const byteLength = Buffer.byteLength(utf8Payload, 'utf8');
  const maxInline = getInlineMaxBytes();

  if (byteLength <= maxInline) {
    return {
      storageKind: 'INLINE',
      drawingData: utf8Payload,
      storageKey: null,
      byteLength,
    };
  }

  const storageKey = `game/${flipbookId}/${drawingId}.json`;
  await writeDrawingBlob(storageKey, utf8Payload);
  return {
    storageKind: 'LOCAL_FILE',
    drawingData: null,
    storageKey,
    byteLength,
  };
}

export async function persistLibraryDrawingPayload(
  ownerId: string,
  savedFlipbookId: string,
  savedDrawingId: string,
  utf8Payload: string
): Promise<PersistedDrawingPayload> {
  const byteLength = Buffer.byteLength(utf8Payload, 'utf8');
  const maxInline = getInlineMaxBytes();

  if (byteLength <= maxInline) {
    return {
      storageKind: 'INLINE',
      drawingData: utf8Payload,
      storageKey: null,
      byteLength,
    };
  }

  const storageKey = `library/${ownerId}/${savedFlipbookId}/${savedDrawingId}.json`;
  await writeDrawingBlob(storageKey, utf8Payload);
  return {
    storageKind: 'LOCAL_FILE',
    drawingData: null,
    storageKey,
    byteLength,
  };
}

export async function resolveGameDrawingPayload(drawing: Drawing): Promise<string> {
  if (drawing.storageKind === 'LOCAL_FILE') {
    if (!drawing.storageKey) {
      throw new Error('DRAWING_BLOB_KEY_MISSING');
    }
    try {
      return await readDrawingBlob(drawing.storageKey);
    } catch (e: any) {
      logError('Failed to read drawing blob', { storageKey: drawing.storageKey, error: e?.message });
      throw new Error('DRAWING_BLOB_READ_FAILED');
    }
  }
  if (drawing.drawingData == null || drawing.drawingData === '') {
    throw new Error('DRAWING_INLINE_DATA_MISSING');
  }
  return drawing.drawingData;
}

export async function resolveSavedDrawingPayload(row: SavedDrawing): Promise<string> {
  if (row.storageKind === 'LOCAL_FILE') {
    if (!row.storageKey) {
      throw new Error('DRAWING_BLOB_KEY_MISSING');
    }
    try {
      return await readDrawingBlob(row.storageKey);
    } catch (e: any) {
      logError('Failed to read saved drawing blob', { storageKey: row.storageKey, error: e?.message });
      throw new Error('DRAWING_BLOB_READ_FAILED');
    }
  }
  if (row.drawingData == null || row.drawingData === '') {
    throw new Error('DRAWING_INLINE_DATA_MISSING');
  }
  return row.drawingData;
}
