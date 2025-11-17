import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

export type UserRole = 'admin' | 'guest';

export interface SessionData {
  token: string;
  username: string;
  role: UserRole;
  createdAt: number;
  expiresAt: number;
}

// In-memory session store (for development)
// In production, use Redis, database, or other persistent storage
const sessionStore = new Map<string, SessionData>();

// Session configuration
const SESSION_DURATION = process.env.SESSION_DURATION 
  ? parseInt(process.env.SESSION_DURATION, 10) 
  : 24 * 60 * 60 * 1000; // Default: 24 hours in milliseconds
const COOKIE_NAME = 'session_token';

/**
 * Get session token from NextRequest (for route handlers)
 */
export function getSessionTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value || null;
}

/**
 * Get current session from NextRequest (for route handlers)
 */
export function getSessionFromRequest(request: NextRequest): SessionData | null {
  const token = getSessionTokenFromRequest(request);
  
  if (!token) {
    return null;
  }
  
  return verifySession(token);
}

/**
 * Generate a secure random token
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new session for a user
 */
export function createSession(username: string, role: UserRole = 'guest'): SessionData {
  const token = generateToken();
  const now = Date.now();
  
  const sessionData: SessionData = {
    token,
    username,
    role,
    createdAt: now,
    expiresAt: now + SESSION_DURATION,
  };
  
  sessionStore.set(token, sessionData);
  
  // Clean up expired sessions periodically
  cleanupExpiredSessions();
  
  return sessionData;
}

/**
 * Verify a session token and return session data if valid
 */
export function verifySession(token: string): SessionData | null {
  const session = sessionStore.get(token);
  
  if (!session) {
    return null;
  }
  
  // Check if session has expired
  if (Date.now() > session.expiresAt) {
    sessionStore.delete(token);
    return null;
  }
  
  return session;
}

/**
 * Delete a session
 */
export function deleteSession(token: string): void {
  sessionStore.delete(token);
}

/**
 * Clean up expired sessions from the store
 */
function cleanupExpiredSessions(): void {
  const now = Date.now();
  
  for (const [token, session] of sessionStore.entries()) {
    if (now > session.expiresAt) {
      sessionStore.delete(token);
    }
  }
}

/**
 * Set session cookie in the response
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000, // Convert to seconds
    path: '/',
  });
}

/**
 * Get session token from cookies
 */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  
  return cookie?.value || null;
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

/**
 * Get current user session from cookies
 */
export async function getCurrentSession(): Promise<SessionData | null> {
  const token = await getSessionToken();
  
  if (!token) {
    return null;
  }
  
  return verifySession(token);
}

/**
 * Extend session expiration time
 */
export function extendSession(token: string): boolean {
  const session = sessionStore.get(token);
  
  if (!session) {
    return false;
  }
  
  const now = Date.now();
  
  // Only extend if session hasn't expired
  if (now > session.expiresAt) {
    sessionStore.delete(token);
    return false;
  }
  
  // Extend the session
  session.expiresAt = now + SESSION_DURATION;
  sessionStore.set(token, session);
  
  return true;
}

/**
 * Get all active sessions for a user (useful for "logout everywhere" functionality)
 */
export function getUserSessions(username: string): SessionData[] {
  const sessions: SessionData[] = [];
  const now = Date.now();
  
  for (const [token, session] of sessionStore.entries()) {
    if (session.username === username && now <= session.expiresAt) {
      sessions.push(session);
    }
  }
  
  return sessions;
}

/**
 * Delete all sessions for a user
 */
export function deleteAllUserSessions(username: string): void {
  for (const [token, session] of sessionStore.entries()) {
    if (session.username === username) {
      sessionStore.delete(token);
    }
  }
}
