'use client';

import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface AuthContextType {
  loggedIn: boolean;
  username: string | null;
  login: (user: string, pass: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
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
        } else {
          setLoggedIn(false);
          setUsername(null);
        }
      } catch (error) {
        console.error("Failed to fetch auth status", error);
        setLoggedIn(false);
        setUsername(null);
      }
      finally {
        setIsLoading(false);
      }
    };
    checkStatus();
  }, []);

  const login = async (user: string, pass: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies in request
        body: JSON.stringify({ username: user, password: pass }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setLoggedIn(true);
        setUsername(user);
        setIsLoading(false);
        return true;
      } else {
        setLoggedIn(false);
        setUsername(null);
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error("Login failed", error);
      setLoggedIn(false);
      setUsername(null);
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
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ loggedIn, username, login, logout, isLoading }}>
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

