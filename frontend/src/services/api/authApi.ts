/**
 * Authentication API service
 * Handles all auth-related API calls matching backend endpoints
 */

import { resolveApiBaseUrl, withApiPrefix } from '../../config/runtimeUrls';
import { httpClient, HttpError, type ApiError } from './httpClient';
import { authenticatedClient } from './authenticatedClient';

function parseAvatarUploadErrorBody(data: unknown, fallback: string): ApiError {
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (typeof o.error === 'string') {
      const message = typeof o.message === 'string' ? o.message : undefined;
      return message ? { error: o.error, message } : { error: o.error };
    }
    if (typeof o.message === 'string') {
      return { error: o.message };
    }
  }
  if (typeof data === 'string' && data.trim()) {
    return { error: data };
  }
  return { error: fallback };
}

// Request types
export interface CreateUserRequest {
  username: string;
  password: string;
  profilePicture?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RefreshTokenRequest {
  token: string;
}

export interface DeleteAccountRequest {
  password: string;
}

// Response types
export interface User {
  id: string;
  username: string;
  profilePicture?: string | null;
  createdAt: string;
}

export interface CreateUserResponse {
  id: string;
  username: string;
  profilePicture?: string | null;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    profilePicture?: string | null;
    totalVotesReceived: number;
    wins: number;
    gamesPlayed: number;
  };
}

export interface CurrentUserResponse {
  id: string;
  username: string;
  profilePicture?: string | null;
  createdAt: string;
  totalVotesReceived: number;
  wins: number;
  gamesPlayed: number;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface LogoutResponse {
  message: string;
}

export interface LogoutAllResponse {
  message: string;
  revokedCount: number;
}

export interface DeleteAccountResponse {
  message: string;
}

/**
 * Create a new user account (signup)
 * POST /auth/create-user
 */
export async function createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
  return httpClient.post<CreateUserResponse>('/auth/create-user', data);
}

/**
 * Login with username and password
 * POST /auth/login
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  return httpClient.post<LoginResponse>('/auth/login', data);
}

/**
 * Refresh access token using refresh token
 * POST /auth/refresh
 */
export async function refreshToken(data: RefreshTokenRequest): Promise<RefreshTokenResponse> {
  return httpClient.post<RefreshTokenResponse>('/auth/refresh', data);
}

/**
 * Get all users (requires authentication)
 * GET /auth/all-users
 */
export async function getAllUsers(): Promise<User[]> {
  return authenticatedClient.get<User[]>('/auth/all-users');
}

/**
 * Signed-in user profile including game statistics.
 * GET /auth/me
 */
export async function getCurrentUser(): Promise<CurrentUserResponse> {
  return authenticatedClient.get<CurrentUserResponse>('/auth/me');
}

/**
 * Upload a new profile image (JPEG, PNG, or WebP, max 2 MB). Returns updated profile.
 * POST /auth/me/avatar (multipart field name: `avatar`)
 */
export async function uploadProfileAvatar(file: File): Promise<CurrentUserResponse> {
  const base = resolveApiBaseUrl().replace(/\/$/, '');
  const path = withApiPrefix('/auth/me/avatar');
  const url = `${base}${path}`;
  const token = localStorage.getItem('accessToken');
  if (!token) {
    throw new Error('No access token available. Please login.');
  }
  const body = new FormData();
  body.append('avatar', file);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = await response.text();
  }
  if (!response.ok) {
    const apiError = parseAvatarUploadErrorBody(data, response.statusText);
    throw new HttpError(response.status, response.statusText, apiError);
  }
  return data as CurrentUserResponse;
}

/**
 * Logout from current device (revokes refresh token)
 * POST /auth/logout
 */
export async function logout(data: RefreshTokenRequest): Promise<LogoutResponse> {
  return httpClient.post<LogoutResponse>('/auth/logout', data);
}

/**
 * Logout from all devices (requires authentication)
 * POST /auth/logout-all
 */
export async function logoutAll(): Promise<LogoutAllResponse> {
  return authenticatedClient.post<LogoutAllResponse>('/auth/logout-all', {});
}

/**
 * Delete user account (requires authentication and password confirmation)
 * DELETE /auth/delete-account
 */
export async function deleteAccount(data: DeleteAccountRequest): Promise<DeleteAccountResponse> {
  return authenticatedClient.delete<DeleteAccountResponse>('/auth/delete-account', data);
}
