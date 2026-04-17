import { resolveApiBaseUrl } from '../config/runtimeUrls';

/**
 * Turn stored `User.profilePicture` into a URL suitable for `<img src>`.
 * Supports absolute URLs (S3 / CDN) and same-host `/api/...` paths for local uploads.
 */
export function resolveProfilePictureSrc(raw: string | null | undefined): string | undefined {
  if (raw == null || typeof raw !== 'string') {
    return undefined;
  }
  const s = raw.trim();
  if (!s) {
    return undefined;
  }
  if (s.startsWith('http://') || s.startsWith('https://')) {
    return s;
  }
  const base = resolveApiBaseUrl().replace(/\/$/, '');
  const path = s.startsWith('/') ? s : `/${s}`;
  if (!base) {
    return path;
  }
  return `${base}${path}`;
}
