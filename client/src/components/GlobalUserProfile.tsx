import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import UserProfile from "./UserProfile";

/**
 * Global User Profile Modal Component
 * This component provides a user profile modal that can be accessed from anywhere in the app
 */
export const GlobalUserProfile: React.FC = () => {
  const { user } = useAuth();
  const [showProfile, setShowProfile] = useState(false);

  // Don't render anything if user is not authenticated
  if (!user) {
    return null;
  }

  return (
    <>
      {/* User Profile Button - Always visible */}
      <button
        onClick={() => setShowProfile(true)}
        className="global-user-profile-button"
        title="User Profile"
      >
        <div className="user-avatar-small">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="User Avatar" />
          ) : (
            <span>{user.firstName?.[0] || user.email[0].toUpperCase()}</span>
          )}
        </div>
        <span className="user-name">
          {user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.email}
        </span>
      </button>

      {/* User Profile Modal */}
      {showProfile && (
        <div className="user-profile-overlay">
          <div className="user-profile-container">
            <button
              onClick={() => setShowProfile(false)}
              className="close-profile-button"
              aria-label="Close profile"
            >
              ×
            </button>
            <UserProfile />
          </div>
        </div>
      )}
    </>
  );
};

