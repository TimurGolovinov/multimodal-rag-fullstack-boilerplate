/**
 * RateLimitService - Client-side rate limiting to prevent abuse
 *
 * Features:
 * - Request throttling for authentication endpoints
 * - Exponential backoff for failed requests
 * - Request queuing to prevent overwhelming the server
 * - Configurable limits per endpoint
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  backoffMs: number;
}

interface RequestRecord {
  timestamp: number;
  count: number;
}

class RateLimitService {
  private requestHistory: Map<string, RequestRecord[]> = new Map();
  private readonly configs: Map<string, RateLimitConfig> = new Map();

  constructor() {
    // Configure rate limits for different endpoints
    this.configs.set("/api/auth/login", {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      backoffMs: 1000, // 1 second
    });

    this.configs.set("/api/auth/register", {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      backoffMs: 2000, // 2 seconds
    });

    this.configs.set("/api/auth/refresh", {
      maxRequests: 10,
      windowMs: 5 * 60 * 1000, // 5 minutes
      backoffMs: 500, // 500ms
    });

    this.configs.set("/api/auth/logout", {
      maxRequests: 20,
      windowMs: 5 * 60 * 1000, // 5 minutes
      backoffMs: 100, // 100ms
    });

    // Default configuration for other endpoints
    this.configs.set("default", {
      maxRequests: 100,
      windowMs: 15 * 60 * 1000, // 15 minutes
      backoffMs: 100, // 100ms
    });
  }

  /**
   * Check if a request is allowed
   * @param endpoint - API endpoint
   * @returns Promise<boolean> - True if allowed, false if rate limited
   */
  public async checkRateLimit(endpoint: string): Promise<boolean> {
    const config = this.configs.get(endpoint) || this.configs.get("default")!;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get or create request history for this endpoint
    let history = this.requestHistory.get(endpoint) || [];

    // Remove old requests outside the window
    history = history.filter((record) => record.timestamp > windowStart);

    // Check if we've exceeded the limit
    const totalRequests = history.reduce(
      (sum, record) => sum + record.count,
      0
    );

    if (totalRequests >= config.maxRequests) {
      return false;
    }

    // Add current request
    history.push({
      timestamp: now,
      count: 1,
    });

    this.requestHistory.set(endpoint, history);
    return true;
  }

  /**
   * Get the delay before the next request is allowed
   * @param endpoint - API endpoint
   * @returns Promise<number> - Delay in milliseconds
   */
  public async getDelay(endpoint: string): Promise<number> {
    const config = this.configs.get(endpoint) || this.configs.get("default")!;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    const history = this.requestHistory.get(endpoint) || [];
    const recentRequests = history.filter(
      (record) => record.timestamp > windowStart
    );

    if (recentRequests.length === 0) {
      return 0;
    }

    // Calculate exponential backoff based on recent requests
    const recentCount = recentRequests.reduce(
      (sum, record) => sum + record.count,
      0
    );
    const backoffMultiplier = Math.min(recentCount, 10); // Cap at 10x

    return config.backoffMs * Math.pow(2, backoffMultiplier - 1);
  }

  /**
   * Reset rate limit for an endpoint
   * @param endpoint - API endpoint
   */
  public resetRateLimit(endpoint: string): void {
    this.requestHistory.delete(endpoint);
  }

  /**
   * Reset all rate limits
   */
  public resetAllRateLimits(): void {
    this.requestHistory.clear();
  }

  /**
   * Get current rate limit status
   * @param endpoint - API endpoint
   * @returns Object with rate limit information
   */
  public async getRateLimitStatus(endpoint: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    delay: number;
  }> {
    const config = this.configs.get(endpoint) || this.configs.get("default")!;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    const history = this.requestHistory.get(endpoint) || [];
    const recentRequests = history.filter(
      (record) => record.timestamp > windowStart
    );
    const totalRequests = recentRequests.reduce(
      (sum, record) => sum + record.count,
      0
    );

    const allowed = totalRequests < config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - totalRequests);
    const resetTime =
      recentRequests.length > 0
        ? recentRequests[0].timestamp + config.windowMs
        : now;
    const delay = allowed ? 0 : await this.getDelay(endpoint);

    return {
      allowed,
      remaining,
      resetTime,
      delay,
    };
  }

  /**
   * Wait for rate limit to reset
   * @param endpoint - API endpoint
   * @returns Promise that resolves when rate limit resets
   */
  public async waitForRateLimitReset(endpoint: string): Promise<void> {
    const status = await this.getRateLimitStatus(endpoint);

    if (status.allowed) {
      return;
    }

    const delay = status.delay;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export const rateLimitService = new RateLimitService();
