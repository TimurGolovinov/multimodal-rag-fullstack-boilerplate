import {
  type LoginRequest,
  type RegisterRequest,
  type AuthResponse,
  type UserResponse,
  type AuthTokens,
  type User,
} from "../types/auth";
import { rateLimitService } from "./rateLimitService";

/**
 * Authentication service for API calls
 */
class AuthService {
  private baseURL: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE || "http://localhost:3000";

    // Load tokens from localStorage on initialization
    this.loadTokens();
  }

  /**
   * Load tokens from localStorage (only access token now)
   */
  private loadTokens(): void {
    this.accessToken = localStorage.getItem("accessToken");
    // Refresh token is now stored in httpOnly cookie, not localStorage
    this.refreshToken = null;
  }

  /**
   * Save tokens (only access token to localStorage)
   */
  private saveTokens(tokens: AuthTokens): void {
    this.accessToken = tokens.accessToken;
    // Refresh token is now stored in httpOnly cookie by the server
    this.refreshToken = null;

    localStorage.setItem("accessToken", tokens.accessToken);
    // Don't store refresh token in localStorage for security
  }

  /**
   * Clear tokens from localStorage
   */
  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;

    localStorage.removeItem("accessToken");
    // Refresh token cookie is cleared by the server
  }

  /**
   * Get authorization header
   */
  private getAuthHeader(): { Authorization: string } | object {
    return this.accessToken
      ? { Authorization: `Bearer ${this.accessToken}` }
      : {};
  }

  /**
   * Create fetch request configuration
   */
  private createRequestConfig(
    method: string = "GET",
    body?: unknown
  ): RequestInit {
    return {
      method,
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeader(),
        ...this.getCSRFHeader(),
      },
      credentials: "include", // Include cookies in requests
      body: body ? JSON.stringify(body) : undefined,
    };
  }

  /**
   * Get CSRF token header
   */
  private getCSRFHeader(): { [key: string]: string } | object {
    const csrfToken = localStorage.getItem("csrfToken");
    return csrfToken ? { "x-csrf-token": csrfToken } : {};
  }

  /**
   * Handle API response
   */
  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          errorData.error ||
          `HTTP error! status: ${response.status}`
      );
    }
    return response.json();
  }

  /**
   * Handle API error
   */
  private handleError(error: unknown): never {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error((error as Error).message || "Network error");
  }

  /**
   * Login user
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      // Get CSRF token before login
      await this.getCSRFToken();

      // Check rate limit
      const endpoint = "/api/auth/login";
      const allowed = await rateLimitService.checkRateLimit(endpoint);

      if (!allowed) {
        await rateLimitService.waitForRateLimitReset(endpoint);
      }

      const response = await fetch(
        `${this.baseURL}${endpoint}`,
        this.createRequestConfig("POST", credentials)
      );
      const data = await this.handleResponse<AuthResponse>(response);

      if (data.success && data.data) {
        this.saveTokens({
          accessToken: data.data.accessToken,
          refreshToken: data.data.refreshToken,
        });
      }

      return data;
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Register user
   */
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      // Get CSRF token before register
      await this.getCSRFToken();

      // Check rate limit
      const endpoint = "/api/auth/register";
      const allowed = await rateLimitService.checkRateLimit(endpoint);

      if (!allowed) {
        await rateLimitService.waitForRateLimitReset(endpoint);
      }

      const response = await fetch(
        `${this.baseURL}${endpoint}`,
        this.createRequestConfig("POST", userData)
      );
      const data = await this.handleResponse<AuthResponse>(response);

      if (data.success && data.data) {
        this.saveTokens({
          accessToken: data.data.accessToken,
          refreshToken: data.data.refreshToken,
        });
      }

      return data;
    } catch (error: unknown) {
      this.handleError(error);
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<UserResponse> {
    try {
      const response = await fetch(
        `${this.baseURL}/api/auth/me`,
        this.createRequestConfig("GET")
      );
      return this.handleResponse<UserResponse>(response);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get CSRF token
   */
  async getCSRFToken(): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseURL}/api/auth/csrf-token`,
        this.createRequestConfig("GET")
      );
      const data = await this.handleResponse<{
        success: boolean;
        data: { csrfToken: string };
      }>(response);

      if (data.success && data.data) {
        localStorage.setItem("csrfToken", data.data.csrfToken);
        return data.data.csrfToken;
      }

      return null;
    } catch (error: unknown) {
      console.error("Failed to get CSRF token:", error);
      return null;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<boolean> {
    try {
      // Check rate limit
      const endpoint = "/api/auth/refresh";
      const allowed = await rateLimitService.checkRateLimit(endpoint);

      if (!allowed) {
        await rateLimitService.waitForRateLimitReset(endpoint);
      }

      // Refresh token is now sent via httpOnly cookie
      const response = await fetch(
        `${this.baseURL}${endpoint}`,
        this.createRequestConfig("POST")
      );

      const data = await this.handleResponse<AuthResponse>(response);

      if (data.success && data.data) {
        this.saveTokens({
          accessToken: data.data.accessToken,
          refreshToken: "", // Not needed anymore
        });
        return true;
      }

      return false;
    } catch (error: unknown) {
      // If refresh fails, clear tokens
      console.error("Failed to refresh access token:", error);
      this.clearTokens();
      return false;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      if (this.accessToken) {
        await fetch(
          `${this.baseURL}/api/auth/logout`,
          this.createRequestConfig("POST")
        );
      }
    } catch (error: unknown) {
      // Continue with logout even if API call fails
      console.warn("Logout API call failed:", error);
    } finally {
      this.clearTokens();
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (!this.accessToken) {
      return false;
    }

    // Check if token is expired
    try {
      const payload = JSON.parse(atob(this.accessToken.split(".")[1]));
      const now = Math.floor(Date.now() / 1000);
      return payload.exp > now;
    } catch (error) {
      console.error("Failed to decode token:", error);
      return false;
    }
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Get current refresh token
   */
  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /**
   * Check if access token needs refresh
   * @param thresholdMinutes - Minutes before expiration to consider refresh needed
   */
  needsRefresh(thresholdMinutes: number = 30): boolean {
    if (!this.accessToken) {
      return false;
    }

    try {
      const payload = JSON.parse(atob(this.accessToken.split(".")[1]));
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiration = payload.exp - now;
      const thresholdSeconds = thresholdMinutes * 60;

      return timeUntilExpiration <= thresholdSeconds;
    } catch (error) {
      console.error("Failed to decode token for refresh check:", error);
      return true; // If we can't decode, assume it needs refresh
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userData: Partial<User>): Promise<UserResponse> {
    try {
      const response = await fetch(
        `${this.baseURL}/api/users/profile`,
        this.createRequestConfig("PUT", userData)
      );
      return this.handleResponse<UserResponse>(response);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Change password
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(
        `${this.baseURL}/api/users/password`,
        this.createRequestConfig("PUT", {
          currentPassword,
          newPassword,
        })
      );
      return this.handleResponse<{ success: boolean; message: string }>(
        response
      );
    } catch (error) {
      this.handleError(error);
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
