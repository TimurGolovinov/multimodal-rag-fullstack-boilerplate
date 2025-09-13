import React, { useCallback, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import "./UserProfile.css";

const UserProfile: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    },
    []
  );

  const handleSave = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      await updateUser({
        firstName: formData.firstName,
        lastName: formData.lastName,
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  }, [formData, updateUser]);

  const handleCancel = useCallback(() => {
    setFormData({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
    });
    setIsEditing(false);
    setError("");
  }, [user?.email, user?.firstName, user?.lastName]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
    }
  }, [logout]);

  if (!user) {
    return null;
  }

  return (
    <div className="user-profile">
      <div className="user-profile-content">
        {error && <div className="error-message">{error}</div>}

        <div className="profile-section">
          <h4>Profile Information</h4>

          {isEditing ? (
            <div className="edit-form">
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  disabled={isLoading}
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  disabled
                  className="disabled"
                />
                <small>Email cannot be changed</small>
              </div>

              <div className="form-actions">
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="btn btn-primary"
                >
                  {isLoading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="profile-display">
              <div className="profile-field">
                <label>First Name</label>
                <span>{user.firstName || "Not set"}</span>
              </div>
              <div className="profile-field">
                <label>Last Name</label>
                <span>{user.lastName || "Not set"}</span>
              </div>
              <div className="profile-field">
                <label>Email</label>
                <span>{user.email}</span>
              </div>
              <div className="profile-field">
                <label>Role</label>
                <span className="role-badge">{user.role}</span>
              </div>
              <div className="profile-field">
                <label>Status</label>
                <span
                  className={`status-badge ${
                    user.isVerified ? "verified" : "unverified"
                  }`}
                >
                  {user.isVerified ? "Verified" : "Unverified"}
                </span>
              </div>
              <div className="profile-field">
                <label>Member Since</label>
                <span>{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
              {user.lastLogin && (
                <div className="profile-field">
                  <label>Last Login</label>
                  <span>{new Date(user.lastLogin).toLocaleString()}</span>
                </div>
              )}

              <div className="profile-actions">
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn btn-primary"
                >
                  Edit Profile
                </button>
                <button onClick={handleLogout} className="btn btn-danger">
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
