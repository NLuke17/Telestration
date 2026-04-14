/** REST routes are mounted under `/api` on the backend (SPA keeps /lobby/*, /game/* for HTML). */
export function withApiPrefix(endpoint: string): string {
  const p = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (p === '/api' || p.startsWith('/api/')) {
    return p;
  }
  return `/api${p}`;
}

/**
 * Production builds use same-origin requests through CloudFront (empty VITE_*).
 * Local dev keeps defaults pointing at localhost:8000.
 */
export function getApiBaseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL;
  if (typeof v === 'string' && v.length > 0) {
    return v.replace(/\/$/, '');
  }
  return '';
}

/**
 * Base URL for fetch() — NOT `getApiBaseUrl() || localhost`: empty string is valid for same-origin
 * production (CloudFront), and `'' || 'http://localhost:8000'` would incorrectly force localhost.
 */
export function resolveApiBaseUrl(): string {
  const fromEnv = getApiBaseUrl();
  if (fromEnv !== '') return fromEnv;
  return import.meta.env.DEV ? 'http://localhost:8000' : '';
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  return `${base}${path}`;
}

/**
 * Same-origin WS in production (CloudFront → ALB). Ignore accidental `VITE_WS_URL=ws://localhost...`
 * baked into a prod build — same failure mode as empty API base incorrectly forcing localhost.
 */
export function resolveWebSocketUrl(): string {
  const v = import.meta.env.VITE_WS_URL;
  const hasExplicit = typeof v === 'string' && v.length > 0;
  const isLocalhostWs = hasExplicit && /localhost|127\.0\.0\.1/i.test(v);

  if (hasExplicit && !(import.meta.env.PROD && isLocalhostWs)) {
    return v;
  }
  if (typeof window === 'undefined') {
    return 'ws://localhost:8000/ws';
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}
