import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { absoluteUrlFromReq } from '../utils/publicUrl';
import { logError, logInfo } from '../utils/logger';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MiB

function getAvatarRoot(): string {
  return process.env.AVATAR_LOCAL_PATH || path.join(process.cwd(), 'data', 'avatars');
}

function sniffImageMime(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length < 12) {
    return null;
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  const riff = buf.toString('ascii', 0, 4);
  const webp = buf.toString('ascii', 8, 12);
  if (riff === 'RIFF' && webp === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

function extForMime(m: 'image/jpeg' | 'image/png' | 'image/webp'): string {
  if (m === 'image/jpeg') return 'jpg';
  if (m === 'image/png') return 'png';
  return 'webp';
}

/**
 * Persist avatar bytes and return the **public** URL clients should store in `User.profilePicture`.
 * - **Local (default):** writes under `data/avatars/{userId}/` and returns same-origin `/api/media/...` URL.
 * - **S3 (optional):** when `AVATAR_S3_BUCKET` is set, uploads via PutObject and returns `AVATAR_PUBLIC_BASE_URL` + key.
 */
export async function persistUserAvatar(
  req: Request,
  userId: string,
  buffer: Buffer
): Promise<{ publicUrl: string; mime: string }> {
  if (buffer.length > MAX_BYTES) {
    throw new Error('AVATAR_TOO_LARGE');
  }
  const mime = sniffImageMime(buffer);
  if (!mime) {
    throw new Error('AVATAR_INVALID_IMAGE');
  }
  const ext = extForMime(mime);
  const objectName = `${randomUUID()}.${ext}`;

  const bucket = process.env.AVATAR_S3_BUCKET?.trim();
  if (bucket) {
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
    const publicBase = process.env.AVATAR_PUBLIC_BASE_URL?.replace(/\/$/, '');
    if (!publicBase) {
      throw new Error('AVATAR_PUBLIC_BASE_URL_REQUIRED_WITH_S3');
    }
    const key = `avatars/${userId}/${objectName}`;
    const client = new S3Client({ region });
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mime,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
    const publicUrl = `${publicBase}/${key}`;
    logInfo('Avatar uploaded to S3', { userId, key });
    return { publicUrl, mime };
  }

  const root = path.resolve(getAvatarRoot());
  const userDir = path.join(root, userId);
  const absFile = path.join(userDir, objectName);
  if (!absFile.startsWith(root + path.sep)) {
    throw new Error('AVATAR_PATH_INVALID');
  }
  await fs.mkdir(userDir, { recursive: true });
  await fs.writeFile(absFile, buffer);

  const publicPath = `/api/media/avatars/${encodeURIComponent(userId)}/${encodeURIComponent(objectName)}`;
  const publicUrl = absoluteUrlFromReq(req, publicPath);
  logInfo('Avatar stored locally', { userId, objectName });
  return { publicUrl, mime };
}

export async function readLocalAvatarFile(userId: string, fileName: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const root = path.resolve(getAvatarRoot());
  const abs = path.join(root, userId, fileName);
  if (!abs.startsWith(root + path.sep)) {
    return null;
  }
  try {
    const buffer = await fs.readFile(abs);
    const mime = sniffImageMime(buffer);
    if (!mime) {
      return null;
    }
    return { buffer, mime };
  } catch (e: any) {
    logError('readLocalAvatarFile failed', { userId, fileName, error: e?.message });
    return null;
  }
}
