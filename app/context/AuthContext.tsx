'use client';

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';

export type UserRole = 'admin' | 'guest';

interface AuthContextType {
  loggedIn: boolean;
  username: string | null;
  role: UserRole | null;
  login: (user: string, pass: string, role?: UserRole, path?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAdmin: boolean;
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check auth status on initial load
    const checkStatus = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/auth/status', {
          credentials: 'include' // Include cookies in request
        });
        if (response.ok) {
          const data = await response.json();
          setLoggedIn(data.loggedIn);
          setUsername(data.username || null);
          setRole(data.role || null);
        } else {
          setLoggedIn(false);
          setUsername(null);
          setRole(null);
        }
      } catch (error) {
        console.error("Failed to fetch auth status", error);
        setLoggedIn(false);
        setUsername(null);
        setRole(null);
      }
      finally {
        setIsLoading(false);
      }
    };
    checkStatus();
  }, []);

  const login = async (user: string, pass: string, loginRole?: UserRole, path?: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies in request
        body: JSON.stringify({ 
          username: user, 
          password: pass,
          role: loginRole,
          path: path
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setLoggedIn(true);
        setUsername(user);
        setRole(data.role || 'guest');
        setIsLoading(false);
        return true;
      } else {
        setLoggedIn(false);
        setUsername(null);
        setRole(null);
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error("Login failed", error);
      setLoggedIn(false);
      setUsername(null);
      setRole(null);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include' // Include cookies in request
      });
      setLoggedIn(false);
      setUsername(null);
      setRole(null);
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isAdmin = role === 'admin';
  const isGuest = role === 'guest';

  return (
    <AuthContext.Provider value={{ loggedIn, username, role, login, logout, isLoading, isAdmin, isGuest }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

