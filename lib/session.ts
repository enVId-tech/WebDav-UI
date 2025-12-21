import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

export type UserRole = 'admin' | 'guest';

export interface SessionData {
  username: string;
  role: UserRole;
  createdAt: number;
  expiresAt: number;
}

// Session configuration
const SESSION_DURATION = process.env.SESSION_DURATION 
  ? parseInt(process.env.SESSION_DURATION, 10) 
  : 24 * 60 * 60 * 1000; // Default: 24 hours in milliseconds
const COOKIE_NAME = 'session_token';
const SECRET_KEY = process.env.SESSION_SECRET || 'dev-secret-key-change-in-production';

/**
 * Sign session data into a JWT-like token
 */
function signSessionToken(data: SessionData): string {
  const payload = JSON.stringify(data);
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(payload);
  const signature = hmac.digest('base64url');
  const token = `${Buffer.from(payload).toString('base64url')}.${signature}`;
  return token;
}

/**
 * Verify and decode a session token
 */
function verifySessionToken(token: string): SessionData | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    const payload = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    
    // Verify signature
    const hmac = crypto.createHmac('sha256', SECRET_KEY);
    hmac.update(payload);
    const expectedSignature = hmac.digest('base64url');
    
    if (signature !== expectedSignature) {
      return null;
    }

    const data = JSON.parse(payload) as SessionData;
    
    // Check expiry
    if (Date.now() > data.expiresAt) {
      return null;
    }

    return data;
  } catch (err) {
    return null;
  }
}

/**
 * Get current session from NextRequest (for route handlers)
 */
export function getSessionFromRequest(request: NextRequest): SessionData | null {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  
  if (!token) {
    return null;
  }
  
  return verifySessionToken(token);
}

/**
 * Create a new session for a user
 */
export function createSession(username: string, role: UserRole = 'guest'): { token: string; sessionData: SessionData } {
  const now = Date.now();
  
  const sessionData: SessionData = {
    username,
    role,
    createdAt: now,
    expiresAt: now + SESSION_DURATION,
  };
  
  const token = signSessionToken(sessionData);
  
  return { token, sessionData };
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
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  
  if (!token) {
    return null;
  }
  
  return verifySessionToken(token);
}

/**
 * Extend session expiration time by issuing a new token
 */
export async function extendSession(oldToken: string): Promise<boolean> {
  const session = verifySessionToken(oldToken);
  
  if (!session) {
    return false;
  }
  
  const now = Date.now();
  const newSessionData: SessionData = {
    ...session,
    expiresAt: now + SESSION_DURATION,
  };
  
  const newToken = signSessionToken(newSessionData);
  await setSessionCookie(newToken);
  
  return true;
}
