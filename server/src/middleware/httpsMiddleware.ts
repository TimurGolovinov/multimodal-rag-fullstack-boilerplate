import { Request, Response, NextFunction } from "express";

/**
 * HTTPS enforcement middleware
 * Ensures all requests in production use HTTPS
 */
export function enforceHTTPS(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only enforce HTTPS in production
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  // Check if request is already HTTPS
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    return next();
  }

  // Redirect to HTTPS
  const httpsUrl = `https://${req.get("host")}${req.originalUrl}`;
  res.redirect(301, httpsUrl);
}

/**
 * HTTPS headers middleware
 * Sets security headers for HTTPS
 */
export function httpsHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only set HTTPS headers in production
  if (process.env.NODE_ENV !== "production") {
    return next();
  }

  // Set HTTPS-related headers
  res.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("X-XSS-Protection", "1; mode=block");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");

  next();
}

/**
 * Trust proxy middleware
 * Configures Express to trust proxy headers
 */
export function trustProxy(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only trust proxy in production
  if (process.env.NODE_ENV === "production") {
    // Trust first proxy (load balancer, reverse proxy)
    req.app.set("trust proxy", 1);
  }

  next();
}
