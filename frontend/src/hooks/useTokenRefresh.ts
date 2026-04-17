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
    if (!isAuthenticated) {
      return undefined;
    }

    const run = async () => {
      try {
        await refreshAccessToken();
      } catch (error) {
        console.error('Failed to refresh token:', error);
      }
    };

    // Rotate once on login / page load so a session that sat >15m still has a valid access token
    void run();

    intervalRef.current = window.setInterval(() => {
      void run();
    }, TOKEN_REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAuthenticated, refreshAccessToken]);
};
