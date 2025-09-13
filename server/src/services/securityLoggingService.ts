import * as fs from "fs";
import * as path from "path";

/**
 * Security event types
 */
export enum SecurityEventType {
  // Authentication events
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGOUT = "LOGOUT",
  REGISTRATION_SUCCESS = "REGISTRATION_SUCCESS",
  REGISTRATION_FAILED = "REGISTRATION_FAILED",
  PASSWORD_CHANGE = "PASSWORD_CHANGE",
  PASSWORD_RESET_REQUEST = "PASSWORD_RESET_REQUEST",
  PASSWORD_RESET_SUCCESS = "PASSWORD_RESET_SUCCESS",
  PASSWORD_RESET_FAILED = "PASSWORD_RESET_FAILED",

  // Authorization events
  ACCESS_DENIED = "ACCESS_DENIED",
  PRIVILEGE_ESCALATION_ATTEMPT = "PRIVILEGE_ESCALATION_ATTEMPT",
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",

  // File events
  FILE_UPLOAD = "FILE_UPLOAD",
  FILE_UPLOAD_FAILED = "FILE_UPLOAD_FAILED",
  FILE_DOWNLOAD = "FILE_DOWNLOAD",
  FILE_DELETE = "FILE_DELETE",
  MALICIOUS_FILE_DETECTED = "MALICIOUS_FILE_DETECTED",

  // API events
  API_RATE_LIMIT_EXCEEDED = "API_RATE_LIMIT_EXCEEDED",
  API_ABUSE_DETECTED = "API_ABUSE_DETECTED",
  SUSPICIOUS_REQUEST = "SUSPICIOUS_REQUEST",

  // Security violations
  CSRF_TOKEN_INVALID = "CSRF_TOKEN_INVALID",
  INVALID_INPUT = "INVALID_INPUT",
  SQL_INJECTION_ATTEMPT = "SQL_INJECTION_ATTEMPT",
  XSS_ATTEMPT = "XSS_ATTEMPT",
  PATH_TRAVERSAL_ATTEMPT = "PATH_TRAVERSAL_ATTEMPT",

  // System events
  SYSTEM_ERROR = "SYSTEM_ERROR",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",

  // Session events
  SESSION_CREATED = "SESSION_CREATED",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  SESSION_HIJACK_ATTEMPT = "SESSION_HIJACK_ATTEMPT",
  MULTIPLE_SESSIONS = "MULTIPLE_SESSIONS",

  // Data events
  DATA_ACCESS = "DATA_ACCESS",
  DATA_MODIFICATION = "DATA_MODIFICATION",
  DATA_EXPORT = "DATA_EXPORT",
  SENSITIVE_DATA_ACCESS = "SENSITIVE_DATA_ACCESS",
}

/**
 * Security event severity levels
 */
export enum SecuritySeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

/**
 * Security event interface
 */
export interface SecurityEvent {
  id: string;
  timestamp: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string;
  ipAddress: string;
  userAgent?: string;
  sessionId?: string;
  message: string;
  details: Record<string, any>;
  riskScore: number; // 0-100
  tags: string[];
}

/**
 * Security logging service
 * Comprehensive logging for security events and monitoring
 */
export class SecurityLoggingService {
  private static readonly LOG_DIR = process.env.LOG_DIR || "./logs";
  private static readonly SECURITY_LOG_FILE = path.join(
    this.LOG_DIR,
    "security.log"
  );
  private static readonly AUDIT_LOG_FILE = path.join(this.LOG_DIR, "audit.log");
  private static readonly ALERT_LOG_FILE = path.join(
    this.LOG_DIR,
    "alerts.log"
  );

  // Risk scores for different event types
  private static readonly RISK_SCORES: Record<SecurityEventType, number> = {
    [SecurityEventType.LOGIN_SUCCESS]: 0,
    [SecurityEventType.LOGIN_FAILED]: 20,
    [SecurityEventType.LOGOUT]: 0,
    [SecurityEventType.REGISTRATION_SUCCESS]: 5,
    [SecurityEventType.REGISTRATION_FAILED]: 15,
    [SecurityEventType.PASSWORD_CHANGE]: 10,
    [SecurityEventType.PASSWORD_RESET_REQUEST]: 15,
    [SecurityEventType.PASSWORD_RESET_SUCCESS]: 10,
    [SecurityEventType.PASSWORD_RESET_FAILED]: 25,
    [SecurityEventType.ACCESS_DENIED]: 30,
    [SecurityEventType.PRIVILEGE_ESCALATION_ATTEMPT]: 80,
    [SecurityEventType.UNAUTHORIZED_ACCESS]: 70,
    [SecurityEventType.FILE_UPLOAD]: 5,
    [SecurityEventType.FILE_UPLOAD_FAILED]: 10,
    [SecurityEventType.FILE_DOWNLOAD]: 5,
    [SecurityEventType.FILE_DELETE]: 10,
    [SecurityEventType.MALICIOUS_FILE_DETECTED]: 90,
    [SecurityEventType.API_RATE_LIMIT_EXCEEDED]: 40,
    [SecurityEventType.API_ABUSE_DETECTED]: 60,
    [SecurityEventType.SUSPICIOUS_REQUEST]: 50,
    [SecurityEventType.CSRF_TOKEN_INVALID]: 30,
    [SecurityEventType.INVALID_INPUT]: 20,
    [SecurityEventType.SQL_INJECTION_ATTEMPT]: 95,
    [SecurityEventType.XSS_ATTEMPT]: 85,
    [SecurityEventType.PATH_TRAVERSAL_ATTEMPT]: 90,
    [SecurityEventType.SYSTEM_ERROR]: 30,
    [SecurityEventType.CONFIGURATION_ERROR]: 50,
    [SecurityEventType.EXTERNAL_SERVICE_ERROR]: 20,
    [SecurityEventType.SESSION_CREATED]: 0,
    [SecurityEventType.SESSION_EXPIRED]: 5,
    [SecurityEventType.SESSION_HIJACK_ATTEMPT]: 80,
    [SecurityEventType.MULTIPLE_SESSIONS]: 30,
    [SecurityEventType.DATA_ACCESS]: 10,
    [SecurityEventType.DATA_MODIFICATION]: 20,
    [SecurityEventType.DATA_EXPORT]: 30,
    [SecurityEventType.SENSITIVE_DATA_ACCESS]: 50,
  };

  // Severity thresholds
  private static readonly SEVERITY_THRESHOLDS = {
    [SecuritySeverity.LOW]: 0,
    [SecuritySeverity.MEDIUM]: 30,
    [SecuritySeverity.HIGH]: 60,
    [SecuritySeverity.CRITICAL]: 80,
  };

  /**
   * Initialize the logging service
   */
  public static initialize(): void {
    // Ensure log directory exists
    if (!fs.existsSync(this.LOG_DIR)) {
      fs.mkdirSync(this.LOG_DIR, { recursive: true });
    }

    // Create log files if they don't exist
    [this.SECURITY_LOG_FILE, this.AUDIT_LOG_FILE, this.ALERT_LOG_FILE].forEach(
      (file) => {
        if (!fs.existsSync(file)) {
          fs.writeFileSync(file, "");
        }
      }
    );

    console.log("Security logging service initialized");
  }

  /**
   * Log a security event
   * @param event - Security event to log
   */
  public static logSecurityEvent(
    event: Omit<SecurityEvent, "id" | "timestamp" | "riskScore" | "severity">
  ): void {
    const fullEvent: SecurityEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      riskScore: this.calculateRiskScore(event.type, event.details),
      severity: this.calculateSeverity(event.type, event.details),
    };

    // Write to security log
    this.writeToLog(this.SECURITY_LOG_FILE, fullEvent);

    // Write to audit log for certain events
    if (this.isAuditEvent(event.type)) {
      this.writeToLog(this.AUDIT_LOG_FILE, fullEvent);
    }

    // Write to alert log for high-risk events
    if (
      fullEvent.severity === SecuritySeverity.HIGH ||
      fullEvent.severity === SecuritySeverity.CRITICAL
    ) {
      this.writeToLog(this.ALERT_LOG_FILE, fullEvent);
      this.sendAlert(fullEvent);
    }

    // Console output for development
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[SECURITY] ${fullEvent.type}: ${fullEvent.message}`,
        fullEvent
      );
    }
  }

  /**
   * Log authentication event
   * @param type - Event type
   * @param userId - User ID
   * @param ipAddress - IP address
   * @param userAgent - User agent
   * @param message - Event message
   * @param details - Additional details
   */
  public static logAuthEvent(
    type: SecurityEventType,
    userId: string | undefined,
    ipAddress: string,
    userAgent: string | undefined,
    message: string,
    details: Record<string, any> = {}
  ): void {
    this.logSecurityEvent({
      type,
      userId,
      ipAddress,
      userAgent,
      message,
      details,
      tags: ["authentication"],
    });
  }

  /**
   * Log file operation event
   * @param type - Event type
   * @param userId - User ID
   * @param ipAddress - IP address
   * @param userAgent - User agent
   * @param message - Event message
   * @param details - Additional details
   */
  public static logFileEvent(
    type: SecurityEventType,
    userId: string | undefined,
    ipAddress: string,
    userAgent: string | undefined,
    message: string,
    details: Record<string, any> = {}
  ): void {
    this.logSecurityEvent({
      type,
      userId,
      ipAddress,
      userAgent,
      message,
      details,
      tags: ["file-operation"],
    });
  }

  /**
   * Log security violation
   * @param type - Event type
   * @param userId - User ID
   * @param ipAddress - IP address
   * @param userAgent - User agent
   * @param message - Event message
   * @param details - Additional details
   */
  public static logSecurityViolation(
    type: SecurityEventType,
    userId: string | undefined,
    ipAddress: string,
    userAgent: string | undefined,
    message: string,
    details: Record<string, any> = {}
  ): void {
    this.logSecurityEvent({
      type,
      userId,
      ipAddress,
      userAgent,
      message,
      details,
      tags: ["security-violation"],
    });
  }

  /**
   * Log API abuse
   * @param type - Event type
   * @param userId - User ID
   * @param ipAddress - IP address
   * @param userAgent - User agent
   * @param message - Event message
   * @param details - Additional details
   */
  public static logApiAbuse(
    type: SecurityEventType,
    userId: string | undefined,
    ipAddress: string,
    userAgent: string | undefined,
    message: string,
    details: Record<string, any> = {}
  ): void {
    this.logSecurityEvent({
      type,
      userId,
      ipAddress,
      userAgent,
      message,
      details,
      tags: ["api-abuse"],
    });
  }

  /**
   * Log suspicious activity
   * @param type - Event type
   * @param userId - User ID
   * @param ipAddress - IP address
   * @param userAgent - User agent
   * @param message - Event message
   * @param details - Additional details
   */
  public static logSuspiciousActivity(
    type: SecurityEventType,
    userId: string | undefined,
    ipAddress: string,
    userAgent: string | undefined,
    message: string,
    details: Record<string, any> = {}
  ): void {
    this.logSecurityEvent({
      type,
      userId,
      ipAddress,
      userAgent,
      message,
      details,
      tags: ["suspicious-activity"],
    });
  }

  /**
   * Calculate risk score for an event
   * @param type - Event type
   * @param details - Event details
   * @returns Risk score (0-100)
   */
  private static calculateRiskScore(
    type: SecurityEventType,
    details: Record<string, any>
  ): number {
    let baseScore = this.RISK_SCORES[type] || 0;

    // Adjust based on details
    if (details.failedAttempts && details.failedAttempts > 3) {
      baseScore += 20;
    }

    if (details.isAdminUser) {
      baseScore += 10;
    }

    if (details.sensitiveData) {
      baseScore += 15;
    }

    if (details.offHours) {
      baseScore += 10;
    }

    return Math.min(100, baseScore);
  }

  /**
   * Calculate severity based on risk score
   * @param type - Event type
   * @param details - Event details
   * @returns Security severity
   */
  private static calculateSeverity(
    type: SecurityEventType,
    details: Record<string, any>
  ): SecuritySeverity {
    const riskScore = this.calculateRiskScore(type, details);

    if (riskScore >= this.SEVERITY_THRESHOLDS[SecuritySeverity.CRITICAL]) {
      return SecuritySeverity.CRITICAL;
    } else if (riskScore >= this.SEVERITY_THRESHOLDS[SecuritySeverity.HIGH]) {
      return SecuritySeverity.HIGH;
    } else if (riskScore >= this.SEVERITY_THRESHOLDS[SecuritySeverity.MEDIUM]) {
      return SecuritySeverity.MEDIUM;
    } else {
      return SecuritySeverity.LOW;
    }
  }

  /**
   * Check if event should be logged to audit log
   * @param type - Event type
   * @returns True if should be audited
   */
  private static isAuditEvent(type: SecurityEventType): boolean {
    const auditEvents = [
      SecurityEventType.LOGIN_SUCCESS,
      SecurityEventType.LOGOUT,
      SecurityEventType.REGISTRATION_SUCCESS,
      SecurityEventType.PASSWORD_CHANGE,
      SecurityEventType.ACCESS_DENIED,
      SecurityEventType.FILE_UPLOAD,
      SecurityEventType.FILE_DELETE,
      SecurityEventType.DATA_ACCESS,
      SecurityEventType.DATA_MODIFICATION,
      SecurityEventType.DATA_EXPORT,
      SecurityEventType.SENSITIVE_DATA_ACCESS,
    ];

    return auditEvents.includes(type);
  }

  /**
   * Write event to log file
   * @param filePath - Log file path
   * @param event - Security event
   */
  private static writeToLog(filePath: string, event: SecurityEvent): void {
    try {
      const logEntry = JSON.stringify(event) + "\n";
      fs.appendFileSync(filePath, logEntry);
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  /**
   * Send alert for high-risk events
   * @param event - Security event
   */
  private static sendAlert(event: SecurityEvent): void {
    // In production, this would integrate with alerting systems
    // For now, just log to console
    console.error(
      `[SECURITY ALERT] ${event.severity} - ${event.type}: ${event.message}`,
      {
        userId: event.userId,
        ipAddress: event.ipAddress,
        riskScore: event.riskScore,
        timestamp: event.timestamp,
      }
    );

    // TODO: Integrate with external alerting services
    // - Send email notifications
    // - Send Slack messages
    // - Send to SIEM systems
    // - Send to monitoring dashboards
  }

  /**
   * Generate unique event ID
   * @returns Event ID
   */
  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get security events from log file
   * @param filePath - Log file path
   * @param limit - Maximum number of events to return
   * @returns Array of security events
   */
  public static getSecurityEvents(
    filePath: string,
    limit: number = 100
  ): SecurityEvent[] {
    try {
      if (!fs.existsSync(filePath)) {
        return [];
      }

      const content = fs.readFileSync(filePath, "utf8");
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.length > 0);

      return lines
        .slice(-limit)
        .map((line) => {
          try {
            return JSON.parse(line) as SecurityEvent;
          } catch {
            return null;
          }
        })
        .filter((event) => event !== null) as SecurityEvent[];
    } catch (error) {
      console.error("Failed to read security events:", error);
      return [];
    }
  }

  /**
   * Get events by severity
   * @param severity - Security severity
   * @param limit - Maximum number of events
   * @returns Array of security events
   */
  public static getEventsBySeverity(
    severity: SecuritySeverity,
    limit: number = 100
  ): SecurityEvent[] {
    const events = this.getSecurityEvents(this.SECURITY_LOG_FILE, 1000);
    return events.filter((event) => event.severity === severity).slice(-limit);
  }

  /**
   * Get events by type
   * @param type - Security event type
   * @param limit - Maximum number of events
   * @returns Array of security events
   */
  public static getEventsByType(
    type: SecurityEventType,
    limit: number = 100
  ): SecurityEvent[] {
    const events = this.getSecurityEvents(this.SECURITY_LOG_FILE, 1000);
    return events.filter((event) => event.type === type).slice(-limit);
  }
}
