/**
 * Enhanced HTTP client with automatic token injection
 * Use this when you want auth tokens automatically added to requests
 */

import { resolveApiBaseUrl, withApiPrefix } from '../../config/runtimeUrls';
import { HttpError } from './httpClient';
import { rotateSessionTokensFromRefresh } from './tokenRefresh';
import { AUTH_LOGOUT_REQUIRED_EVENT } from './authEvents';

const API_BASE_URL = resolveApiBaseUrl();

function isJwtAuthFailure(status: number, data: unknown): boolean {
  // Backend uses 403 + this message for expired/invalid JWT (see authMiddleware).
  // Do not treat generic 401 as JWT failure — e.g. delete-account returns 401 for wrong password.
  if (status !== 403) {
    return false;
  }
  const msg =
    typeof data === 'object' &&
    data !== null &&
    'message' in data &&
    typeof (data as { message: unknown }).message === 'string'
      ? (data as { message: string }).message
      : '';
  return msg.includes('Invalid or expired token');
}

/**
 * Get access token from localStorage
 */
function getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}

/**
 * Make an authenticated request
 * Automatically adds Authorization header with access token
 */
async function authenticatedRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const url = `${API_BASE_URL}${withApiPrefix(endpoint)}`;
  const accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error('No access token available. Please login.');
  }

  const config: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    // Parse JSON response
    let data: any;
    try {
      data = await response.json();
    } catch {
      // If response is not JSON, use text
      data = await response.text();
    }

    if (!response.ok) {
      if (
        !isRetry &&
        isJwtAuthFailure(response.status, data)
      ) {
        const rotated = await rotateSessionTokensFromRefresh();
        if (rotated) {
          return authenticatedRequest<T>(endpoint, options, true);
        }
        window.dispatchEvent(new Event(AUTH_LOGOUT_REQUIRED_EVENT));
      }
      throw new HttpError(response.status, response.statusText, data);
    }

    return data as T;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    // Network or other errors
    throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Authenticated HTTP methods
 * Automatically includes Authorization header with access token
 */
export const authenticatedClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    authenticatedRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    authenticatedRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    authenticatedRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    authenticatedRequest<T>(endpoint, {
      ...options,
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    }),
};

/**
 * Example usage:
 * 
 * import { authenticatedClient } from './authenticatedClient';
 * 
 * // Make authenticated requests without manually adding tokens
 * const users = await authenticatedClient.get('/auth/all-users');
 * const result = await authenticatedClient.post('/auth/logout-all', {});
 * 
 */
