import { httpClient } from './httpClient';

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Uses the current refresh token to obtain new access + refresh tokens.
 * Single-flight: concurrent callers share one network request (rotation revokes the old refresh).
 */
export function rotateSessionTokensFromRefresh(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }
  refreshInFlight = (async (): Promise<boolean> => {
    try {
      const rt = localStorage.getItem('refreshToken');
      if (!rt) {
        return false;
      }
      const data = await httpClient.post<{ accessToken: string; refreshToken: string }>(
        '/auth/refresh',
        { token: rt }
      );
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}
