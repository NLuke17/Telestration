/**
 * Auto Token Refresh Hook
 * Automatically refreshes access token before it expires
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const TOKEN_REFRESH_INTERVAL = 14 * 60 * 1000; // 14 minutes (token expires in 15 minutes)

export const useTokenRefresh = () => {
  const { isAuthenticated, refreshAccessToken } = useAuth();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      // Set up automatic token refresh
      intervalRef.current = setInterval(async () => {
        try {
          await refreshAccessToken();
        } catch (error) {
          console.error('Failed to refresh token:', error);
          // If refresh fails, user will be logged out by the AuthContext
        }
      }, TOKEN_REFRESH_INTERVAL);

      // Cleanup on unmount or when auth state changes
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isAuthenticated, refreshAccessToken]);
};
