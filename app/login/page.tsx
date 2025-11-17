'use client';


import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import styles from '@/app/styles/loginForm.module.scss';
import { geistSans } from '@/app/types/font';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading, loggedIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get the redirect URL from query params, default to '/'
  const redirectUrl = searchParams.get('redirect') || '/';
  const requestedRole = searchParams.get('role');
  const requestedPath = searchParams.get('path') || undefined;

  // If already logged in, redirect immediately
  useEffect(() => {
    if (loggedIn) {
      router.push(redirectUrl);
    }
  }, [loggedIn, redirectUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = await login(
      username,
      password,
      requestedRole === 'guest' ? 'guest' : undefined,
      requestedPath
    );
    if (success) {
      // Redirect to the original page after successful login
      router.push(redirectUrl);
    } else {
      setError('Invalid username or password.');
    }
  };

  const handleGoBack = () => {
    // Navigate back to the previous page
    if (redirectUrl && redirectUrl !== '/') {
      router.push(redirectUrl);
    } else {
      router.back();
    }
  };

  return (
    <div className={`${styles.loginPageWrapper} ${geistSans.className}`}>
      <div className={styles.loginPageContainer}>
        <div className={styles.loginFormContainer}>
          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <h1>Welcome Back</h1>
            <p className={styles.loginSubtitle}>Sign in to access your WebDAV files</p>
            
            {error && <p className={styles.loginError}>{error}</p>}
            
            <div className={styles.inputGroup}>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className={styles.loginInput}
                placeholder="Enter your username"
                autoFocus
              />
            </div>
            
            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={styles.loginInput}
                placeholder="Enter your password"
              />
            </div>
            
            <button type="submit" disabled={isLoading} className={styles.loginButton}>
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
            
            <button 
              type="button" 
              onClick={handleGoBack} 
              className={styles.backButton}
            >
              ← Back to Files
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
