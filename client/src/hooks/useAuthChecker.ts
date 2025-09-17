import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { authService } from "../services/authService";

/**
 * Hook for global authentication checking and token refresh
 *
 * Features:
 * - Periodic token validation
 * - Automatic token refresh before expiration
 * - Logout on refresh failure
 * - Configurable check intervals
 */
export const useAuthChecker = (
  options: {
    checkInterval?: number; // milliseconds between checks (default: 5 minutes)
    refreshThreshold?: number; // minutes before expiration to refresh (default: 30 minutes)
    enabled?: boolean; // whether to enable the checker (default: true)
  } = {}
) => {
  const {
    checkInterval = 5 * 60 * 1000, // 5 minutes
    refreshThreshold = 30 * 60 * 1000, // 30 minutes
    enabled = true,
  } = options;

  const { isAuthenticated, refreshToken, logout } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCheckingRef = useRef(false);

  /**
   * Decode JWT token to get expiration time
   */
  const getTokenExpiration = (token: string): number | null => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.exp * 1000; // Convert to milliseconds
    } catch (error) {
      console.error("Failed to decode token:", error);
      return null;
    }
  };

  /**
   * Check if token needs refresh
   */
  const needsRefresh = (token: string): boolean => {
    return authService.needsRefresh(refreshThreshold / (60 * 1000)); // Convert to minutes
  };

  /**
   * Perform authentication check
   */
  const performAuthCheck = async (): Promise<void> => {
    if (isCheckingRef.current) return;

    isCheckingRef.current = true;

    try {
      if (!isAuthenticated) {
        return;
      }

      const accessToken = authService.getAccessToken();
      if (!accessToken) {
        console.log("No access token found, logging out");
        await logout();
        return;
      }

      // Check if token is expired or needs refresh
      if (needsRefresh(accessToken)) {
        console.log("Token needs refresh, attempting refresh...");

        const refreshed = await refreshToken();
        if (!refreshed) {
          console.log("Token refresh failed, logging out");
          await logout();
        } else {
          console.log("Token refreshed successfully");
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      // Don't logout on network errors, just log the error
    } finally {
      isCheckingRef.current = false;
    }
  };

  /**
   * Start the authentication checker
   */
  const startAuthChecker = (): void => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (!enabled) return;

    // Perform initial check
    performAuthCheck();

    // Set up periodic checking
    intervalRef.current = setInterval(performAuthCheck, checkInterval);
  };

  /**
   * Stop the authentication checker
   */
  const stopAuthChecker = (): void => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Start/stop checker based on authentication state and enabled flag
  useEffect(() => {
    if (enabled && isAuthenticated) {
      startAuthChecker();
    } else {
      stopAuthChecker();
    }

    // Cleanup on unmount
    return () => {
      stopAuthChecker();
    };
  }, [enabled, isAuthenticated]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAuthChecker();
    };
  }, []);

  return {
    startAuthChecker,
    stopAuthChecker,
    performAuthCheck,
  };
};

/**
 * Hook for manual authentication checking
 * Useful for components that need to check auth status on demand
 */
export const useManualAuthCheck = () => {
  const { isAuthenticated, refreshToken, logout } = useAuth();

  const checkAndRefresh = async (): Promise<boolean> => {
    if (!isAuthenticated) {
      return false;
    }

    const accessToken = authService.getAccessToken();
    if (!accessToken) {
      await logout();
      return false;
    }

    try {
      // Try to get current user to validate token
      const response = await authService.getCurrentUser();

      if (response.success) {
        return true;
      }

      // If getting user fails, try to refresh token
      const refreshed = await refreshToken();
      return refreshed;
    } catch (error) {
      console.error("Manual auth check failed:", error);

      // Try to refresh token on error
      const refreshed = await refreshToken();
      if (!refreshed) {
        await logout();
      }
      return refreshed;
    }
  };

  return {
    checkAndRefresh,
  };
};
