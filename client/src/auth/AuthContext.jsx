import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { clearAuthFailureHandler, setAuthFailureHandler } from '../api/http';
import { clearStoredAuth, loadStoredAuth, saveStoredAuth } from './authStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => loadStoredAuth());

  const login = useCallback((nextAuth) => {
    saveStoredAuth(nextAuth);
    setAuth(nextAuth);
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
    setAuth(null);
  }, []);

  useEffect(() => {
    setAuthFailureHandler(logout);
    return () => clearAuthFailureHandler(logout);
  }, [logout]);

  const value = useMemo(() => ({
    auth,
    isAuthenticated: Boolean(auth?.token),
    login,
    logout,
    username: auth?.username || null,
  }), [auth, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
