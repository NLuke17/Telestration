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
 * WebSocket URL for the Node `ws` server (path `/ws`).
 *
 * - Optional `VITE_WS_URL` wins (except prod builds still pointing at localhost — same guard as API URL).
 * - If `resolveApiBaseUrl()` is set (dev default `http://localhost:8000`, or Docker `VITE_API_BASE_URL`), WS uses
 *   that host so the client does not connect to the Vite port by mistake.
 * - Production with empty API base: same-origin `wss://` / `ws://` (CloudFront → ALB).
 */
export function resolveWebSocketUrl(): string {
  const v = import.meta.env.VITE_WS_URL;
  const hasExplicit = typeof v === 'string' && v.length > 0;
  const isLocalhostWs = hasExplicit && /localhost|127\.0\.0\.1/i.test(v);

  if (hasExplicit && !(import.meta.env.PROD && isLocalhostWs)) {
    return v;
  }

  const api = resolveApiBaseUrl();
  if (api) {
    try {
      const u = new URL(api);
      const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProto}//${u.host}/ws`;
    } catch {
      /* ignore invalid VITE_API_BASE_URL */
    }
  }

  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }

  return 'ws://localhost:8000/ws';
}
