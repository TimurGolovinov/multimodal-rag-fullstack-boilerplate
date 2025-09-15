import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  type ReactNode,
} from "react";
import { authService } from "../services/authService";
import {
  type User,
  type AuthContextType,
  type AuthState,
  type LoginRequest,
  type RegisterRequest,
  type AuthResponse,
} from "../types/auth";

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Action types
type AuthAction =
  | { type: "AUTH_START" }
  | { type: "AUTH_SUCCESS"; payload: User }
  | { type: "AUTH_FAILURE"; payload: string }
  | { type: "AUTH_LOGOUT" }
  | { type: "AUTH_CLEAR_ERROR" }
  | { type: "AUTH_UPDATE_USER"; payload: Partial<User> };

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case "AUTH_START":
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case "AUTH_SUCCESS":
      console.log("Auth reducer, Auth success:", action.payload);
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case "AUTH_FAILURE":
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case "AUTH_LOGOUT":
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case "AUTH_CLEAR_ERROR":
      return {
        ...state,
        error: null,
      };
    case "AUTH_UPDATE_USER":
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
    default:
      return state;
  }
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        dispatch({ type: "AUTH_START" });

        // Check if user is authenticated first
        if (authService.isAuthenticated()) {
          // Try to get current user
          const response = await authService.getCurrentUser();

          if (response.success && response.data) {
            dispatch({ type: "AUTH_SUCCESS", payload: response.data.user });
          } else {
            // If getting user fails, try to refresh token
            const refreshed = await authService.refreshAccessToken();

            if (refreshed) {
              const retryResponse = await authService.getCurrentUser();

              if (retryResponse.success && retryResponse.data) {
                dispatch({
                  type: "AUTH_SUCCESS",
                  payload: retryResponse.data.user,
                });
              } else {
                dispatch({
                  type: "AUTH_FAILURE",
                  payload: "Failed to get user information",
                });
              }
            } else {
              dispatch({ type: "AUTH_FAILURE", payload: "Session expired" });
            }
          }
        } else {
          dispatch({ type: "AUTH_FAILURE", payload: "Not authenticated" });
        }
      } catch (error) {
        dispatch({
          type: "AUTH_FAILURE",
          payload:
            error instanceof Error ? error.message : "Authentication failed",
        });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
    try {
      dispatch({ type: "AUTH_START" });

      const response = await authService.login(credentials);

      if (response.success && response.data) {
        dispatch({ type: "AUTH_SUCCESS", payload: response.data.user });
      } else {
        dispatch({
          type: "AUTH_FAILURE",
          payload: response.error || "Login failed",
        });
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Login failed";
      dispatch({ type: "AUTH_FAILURE", payload: errorMessage });
      throw error;
    }
  };

  // Register function
  const register = async (userData: RegisterRequest): Promise<AuthResponse> => {
    try {
      dispatch({ type: "AUTH_START" });

      const response = await authService.register(userData);

      if (response.success && response.data) {
        dispatch({ type: "AUTH_SUCCESS", payload: response.data.user });
      } else {
        dispatch({
          type: "AUTH_FAILURE",
          payload: response.error || "Registration failed",
        });
      }

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Registration failed";
      dispatch({ type: "AUTH_FAILURE", payload: errorMessage });
      throw error;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.warn("Logout error:", error);
    } finally {
      dispatch({ type: "AUTH_LOGOUT" });
    }
  };

  // Refresh token function
  const refreshToken = async (): Promise<boolean> => {
    try {
      const refreshed = await authService.refreshAccessToken();

      if (refreshed) {
        const response = await authService.getCurrentUser();

        if (response.success && response.data) {
          dispatch({ type: "AUTH_SUCCESS", payload: response.data.user });
          return true;
        }
      }

      dispatch({ type: "AUTH_FAILURE", payload: "Session expired" });
      return false;
    } catch (error) {
      console.error("Refresh token error:", error);
      dispatch({ type: "AUTH_FAILURE", payload: "Session expired" });
      return false;
    }
  };

  // Update user function
  const updateUser = async (userData: Partial<User>): Promise<void> => {
    try {
      const response = await authService.updateProfile(userData);

      if (response.success && response.data) {
        dispatch({ type: "AUTH_UPDATE_USER", payload: userData });
      }
    } catch (error) {
      console.error("Update user error:", error);
      throw error;
    }
  };

  const contextValue: AuthContextType = {
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    login,
    register,
    logout,
    refreshToken,
    updateUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

// Custom hook to use auth context
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
};
