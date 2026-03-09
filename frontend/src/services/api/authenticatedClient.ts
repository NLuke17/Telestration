/**
 * Enhanced HTTP client with automatic token injection
 * Use this when you want auth tokens automatically added to requests
 */

import { httpClient, HttpError } from './httpClient';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
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
      // If unauthorized, could trigger token refresh here
      if (response.status === 401) {
        // Token might be expired, should trigger refresh
        console.warn('Access token expired or invalid');
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
