import React, { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import "./AuthGuard.css";

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireAuth?: boolean;
  requireRole?: "admin" | "user" | "viewer";
  requireVerified?: boolean;
}

const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  fallback,
  requireAuth = true,
  requireRole,
  requireVerified = false,
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="auth-guard-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Check authentication requirement
  if (requireAuth && !isAuthenticated) {
    return (
      fallback || (
        <div className="auth-guard-error">
          <div className="error-content">
            <h2>Authentication Required</h2>
            <p>Please sign in to access this page.</p>
            <div className="auth-actions">
              <Link to="/auth" className="auth-link">
                Sign In / Sign Up
              </Link>
            </div>
          </div>
        </div>
      )
    );
  }

  // Check if user exists when authentication is required
  if (requireAuth && !user) {
    return (
      fallback || (
        <div className="auth-guard-error">
          <div className="error-content">
            <h2>User Not Found</h2>
            <p>Unable to load user information.</p>
          </div>
        </div>
      )
    );
  }

  // Check role requirement
  if (requireRole && user && user.role !== requireRole) {
    return (
      fallback || (
        <div className="auth-guard-error">
          <div className="error-content">
            <h2>Access Denied</h2>
            <p>You don't have permission to access this page.</p>
            <p className="role-info">Required role: {requireRole}</p>
          </div>
        </div>
      )
    );
  }

  // Check verification requirement
  if (requireVerified && user && !user.isVerified) {
    return (
      fallback || (
        <div className="auth-guard-error">
          <div className="error-content">
            <h2>Email Verification Required</h2>
            <p>Please verify your email address to access this page.</p>
          </div>
        </div>
      )
    );
  }

  // Check if user is active (only if isActive is explicitly false)
  if (user && user.isActive === false) {
    return (
      fallback || (
        <div className="auth-guard-error">
          <div className="error-content">
            <h2>Account Disabled</h2>
            <p>Your account has been disabled. Please contact support.</p>
          </div>
        </div>
      )
    );
  }

  // All checks passed, render children
  return <>{children}</>;
};

export default AuthGuard;
