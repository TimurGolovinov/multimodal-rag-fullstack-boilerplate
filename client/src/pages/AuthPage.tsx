import React, { useState } from 'react';
import { LoginForm, RegisterForm } from '../components/auth';
import './AuthPage.css';

type AuthMode = 'login' | 'register';

const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');

  const handleSwitchToRegister = () => {
    setMode('register');
  };

  const handleSwitchToLogin = () => {
    setMode('login');
  };

  const handleAuthSuccess = () => {
    // Redirect will be handled by the router
    // The AuthContext will update and the user will be redirected
  };

  return (
    <div className="auth-page">
      <div className="auth-page-background">
        <div className="auth-page-content">
          {mode === 'login' ? (
            <LoginForm
              onSwitchToRegister={handleSwitchToRegister}
              onSuccess={handleAuthSuccess}
            />
          ) : (
            <RegisterForm
              onSwitchToLogin={handleSwitchToLogin}
              onSuccess={handleAuthSuccess}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
