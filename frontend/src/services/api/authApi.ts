/**
 * Authentication API service
 * Handles all auth-related API calls matching backend endpoints
 */

import { httpClient } from './httpClient';
import { authenticatedClient } from './authenticatedClient';

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
  };
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
