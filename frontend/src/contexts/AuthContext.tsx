/**
 * Authentication Context and Hook
 * Manages user authentication state and provides auth functions
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  login as apiLogin,
  createUser as apiCreateUser,
  logout as apiLogout,
  logoutAll as apiLogoutAll,
  deleteAccount as apiDeleteAccount,
} from '../services/api/authApi';
import { rotateSessionTokensFromRefresh } from '../services/api/tokenRefresh';
import { AUTH_LOGOUT_REQUIRED_EVENT } from '../services/api/authEvents';
import type {
  LoginRequest,
  CreateUserRequest,
  LoginResponse,
} from '../services/api/authApi';

interface User {
  id: string;
  username: string;
  profilePicture?: string | null;
  totalVotesReceived?: number;
  wins?: number;
  gamesPlayed?: number;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  signup: (data: CreateUserRequest) => Promise<void>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  /** Merge fields into the signed-in user and persist to `localStorage` (e.g. after avatar upload). */
  mergeUserToSession: (patch: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Local storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const loadAuthState = () => {
      try {
        const storedAccessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        const storedRefreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        const storedUser = localStorage.getItem(STORAGE_KEYS.USER);

        if (storedAccessToken && storedRefreshToken && storedUser) {
          setAccessToken(storedAccessToken);
          setRefreshToken(storedRefreshToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
        clearAuthState();
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthState();
  }, [clearAuthState]);

  // Save auth state to localStorage
  const saveAuthState = (data: LoginResponse) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
  };

  useEffect(() => {
    const onLogoutRequired = () => {
      clearAuthState();
    };
    window.addEventListener(AUTH_LOGOUT_REQUIRED_EVENT, onLogoutRequired);
    return () => window.removeEventListener(AUTH_LOGOUT_REQUIRED_EVENT, onLogoutRequired);
  }, [clearAuthState]);

  // Login function
  const login = async (data: LoginRequest) => {
    try {
      const response = await apiLogin(data);
      saveAuthState(response);
    } catch (error) {
      throw error;
    }
  };

  // Signup function
  const signup = async (data: CreateUserRequest) => {
    try {
      // Create user first, then auto-login
      await apiCreateUser(data);
      await login({ username: data.username, password: data.password });
    } catch (error) {
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      if (refreshToken) {
        await apiLogout({ token: refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuthState();
    }
  };

  // Logout all devices function
  const logoutAllDevices = async () => {
    try {
      await apiLogoutAll();
    } catch (error) {
      console.error('Logout all devices error:', error);
      throw error;
    } finally {
      clearAuthState();
    }
  };

  // Delete account function
  const deleteAccount = async (password: string) => {
    try {
      await apiDeleteAccount({ password });
      clearAuthState();
    } catch (error) {
      throw error;
    }
  };

  // Stable reference required: useTokenRefresh depends on this — a new function each render
  // would re-run the effect, call refresh on every paint, and can clear the session.
  const refreshAccessToken = useCallback(async () => {
    try {
      const ok = await rotateSessionTokensFromRefresh();
      if (!ok) {
        throw new Error('Token refresh failed');
      }
      const nextAccess = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const nextRefresh = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      setAccessToken(nextAccess);
      setRefreshToken(nextRefresh);
    } catch (error) {
      console.error('Token refresh error:', error);
      clearAuthState();
      throw error;
    }
  }, [clearAuthState]);

  const mergeUserToSession = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) {
        return prev;
      }
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(next));
      return next;
    });
  }, []);

  const value: AuthContextType = {
    user,
    accessToken,
    refreshToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    login,
    signup,
    logout,
    logoutAllDevices,
    deleteAccount,
    refreshAccessToken,
    mergeUserToSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
