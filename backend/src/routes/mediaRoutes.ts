import express from 'express';
import { readLocalAvatarFile } from '../services/avatarService';

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Filenames we generate: `{uuid}.{jpg|png|webp}` */
const AVATAR_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

/**
 * Public avatar bytes (local disk). S3-backed avatars use `AVATAR_PUBLIC_BASE_URL` and do not hit this route.
 */
router.get('/avatars/:userId/:fileName', async (req, res) => {
  const { userId, fileName } = req.params;
  if (!UUID_RE.test(userId) || !AVATAR_FILE_RE.test(fileName)) {
    return res.status(400).end();
  }
  const data = await readLocalAvatarFile(userId, fileName);
  if (!data) {
    return res.status(404).end();
  }
  res.setHeader('Content-Type', data.mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.send(data.buffer);
});

export default router;
