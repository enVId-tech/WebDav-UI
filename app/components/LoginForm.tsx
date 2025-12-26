'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import styles from '@/app/styles/loginForm.module.scss';
import { geistSans } from '@/app/types/font';

const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuth();
  const searchParams = useSearchParams();
  
  // Get the path from query parameters
  const requestedPath = searchParams.get('redirect') || undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    console.log("requestedPath in LoginForm:", requestedPath);
    const success = await login(username, password, requestedPath);
    if (!success) {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className={`${styles.loginFormContainer} ${geistSans.className}`}>
      <form onSubmit={handleSubmit} className={styles.loginForm}>
        <h2>Login</h2>
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
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;

