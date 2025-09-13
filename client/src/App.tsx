import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AuthGuard } from "./components/auth";
import { ChatPanel, KnowledgeHub, GlobalUserProfile } from "./components";
import AuthPage from "./pages/AuthPage";
import "./App.css";

// Main app component that requires authentication
const MainApp: React.FC = () => {
  return (
    <div className="main-container">
      <KnowledgeHub />
      <ChatPanel />
      <GlobalUserProfile />
    </div>
  );
};

// App component with routing
const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/auth"
          element={isAuthenticated ? <Navigate to="/" replace /> : <AuthPage />}
        />
        <Route
          path="/"
          element={
            <AuthGuard>
              <MainApp />
            </AuthGuard>
          }
        />
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/" : "/auth"} replace />}
        />
      </Routes>
    </Router>
  );
};

// Root App component with AuthProvider
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
