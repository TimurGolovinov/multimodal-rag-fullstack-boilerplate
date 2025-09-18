/**
 * Performance monitoring service for video processing
 * Tracks metrics, performance, and provides optimization insights
 */

export interface PerformanceMetrics {
  processingTime: number;
  frameExtractionTime: number;
  audioExtractionTime: number;
  thumbnailExtractionTime: number;
  totalFrames: number;
  totalAudioSegments: number;
  fileSize: number;
  videoDuration: number;
  memoryUsage?: number;
  browserInfo: {
    userAgent: string;
    platform: string;
    webAssemblySupport: boolean;
    sharedArrayBufferSupport: boolean;
  };
  performanceScore: number;
}

export interface ProcessingStats {
  startTime: number;
  endTime?: number;
  stages: {
    [key: string]: {
      startTime: number;
      endTime?: number;
      duration?: number;
    };
  };
  errors: string[];
  warnings: string[];
}

export class PerformanceMonitor {
  private stats: ProcessingStats;
  private metrics: Partial<PerformanceMetrics> = {};
  private isMonitoring = false;

  constructor() {
    this.stats = {
      startTime: 0,
      stages: {},
      errors: [],
      warnings: [],
    };
  }

  /**
   * Start monitoring a processing session
   */
  startMonitoring(): void {
    this.isMonitoring = true;
    this.stats = {
      startTime: performance.now(),
      stages: {},
      errors: [],
      warnings: [],
    };
    this.metrics = {};
  }

  /**
   * Stop monitoring and calculate final metrics
   */
  stopMonitoring(): PerformanceMetrics {
    if (!this.isMonitoring) {
      throw new Error("Monitoring not started");
    }

    this.stats.endTime = performance.now();
    this.isMonitoring = false;

    // Calculate final metrics
    const totalTime = this.stats.endTime - this.stats.startTime;
    this.metrics.processingTime = totalTime;

    // Calculate performance score (0-100)
    this.metrics.performanceScore = this.calculatePerformanceScore();

    // Get browser info
    this.metrics.browserInfo = this.getBrowserInfo();

    return this.metrics as PerformanceMetrics;
  }

  /**
   * Mark the start of a processing stage
   */
  startStage(stageName: string): void {
    if (!this.isMonitoring) return;

    this.stats.stages[stageName] = {
      startTime: performance.now(),
    };
  }

  /**
   * Mark the end of a processing stage
   */
  endStage(stageName: string): void {
    if (!this.isMonitoring) return;

    const stage = this.stats.stages[stageName];
    if (stage) {
      stage.endTime = performance.now();
      stage.duration = stage.endTime - stage.startTime;
    }
  }

  /**
   * Record an error
   */
  recordError(error: string): void {
    if (!this.isMonitoring) return;
    this.stats.errors.push(error);
  }

  /**
   * Record a warning
   */
  recordWarning(warning: string): void {
    if (!this.isMonitoring) return;
    this.stats.warnings.push(warning);
  }

  /**
   * Set processing metrics
   */
  setMetrics(metrics: Partial<PerformanceMetrics>): void {
    this.metrics = { ...this.metrics, ...metrics };
  }

  /**
   * Get current processing stats
   */
  getCurrentStats(): ProcessingStats {
    return { ...this.stats };
  }

  /**
   * Calculate performance score based on various factors
   */
  private calculatePerformanceScore(): number {
    let score = 100;

    // Deduct points for errors
    score -= this.stats.errors.length * 10;

    // Deduct points for warnings
    score -= this.stats.warnings.length * 2;

    // Deduct points for slow processing
    const totalTime = this.stats.endTime! - this.stats.startTime;
    if (totalTime > 30000) {
      // 30 seconds
      score -= 20;
    } else if (totalTime > 60000) {
      // 1 minute
      score -= 40;
    }

    // Deduct points for memory issues
    if (
      this.metrics.memoryUsage &&
      this.metrics.memoryUsage > 100 * 1024 * 1024
    ) {
      // 100MB
      score -= 15;
    }

    // Bonus points for efficient processing
    if (this.metrics.totalFrames && this.metrics.totalAudioSegments) {
      const framesPerSecond = this.metrics.totalFrames / (totalTime / 1000);
      const audioPerSecond =
        this.metrics.totalAudioSegments / (totalTime / 1000);

      if (framesPerSecond > 0.5) score += 5;
      if (audioPerSecond > 0.3) score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get browser information
   */
  private getBrowserInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      webAssemblySupport: typeof WebAssembly !== "undefined",
      sharedArrayBufferSupport: typeof SharedArrayBuffer !== "undefined",
    };
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const totalTime = this.stats.endTime! - this.stats.startTime;

    // Processing time recommendations
    if (totalTime > 60000) {
      recommendations.push(
        "Consider reducing video quality or duration for faster processing"
      );
    }

    // Memory recommendations
    if (
      this.metrics.memoryUsage &&
      this.metrics.memoryUsage > 200 * 1024 * 1024
    ) {
      recommendations.push(
        "High memory usage detected. Consider closing other browser tabs"
      );
    }

    // Error recommendations
    if (this.stats.errors.length > 0) {
      recommendations.push(
        "Processing errors detected. Check video format compatibility"
      );
    }

    // Performance score recommendations
    if (this.metrics.performanceScore < 70) {
      recommendations.push(
        "Low performance score. Consider using a more powerful device"
      );
    }

    // Browser support recommendations
    if (!this.metrics.browserInfo?.webAssemblySupport) {
      recommendations.push(
        "WebAssembly not supported. Please use a modern browser"
      );
    }

    if (!this.metrics.browserInfo?.sharedArrayBufferSupport) {
      recommendations.push(
        "SharedArrayBuffer not supported. Some features may be limited"
      );
    }

    return recommendations;
  }

  /**
   * Export metrics for analytics
   */
  exportMetrics(): any {
    return {
      metrics: this.metrics,
      stats: this.stats,
      recommendations: this.getRecommendations(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset monitoring state
   */
  reset(): void {
    this.isMonitoring = false;
    this.stats = {
      startTime: 0,
      stages: {},
      errors: [],
      warnings: [],
    };
    this.metrics = {};
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
