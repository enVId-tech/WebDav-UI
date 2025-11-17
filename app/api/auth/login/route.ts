import { NextRequest, NextResponse } from 'next/server';
import { createSession, setSessionCookie, UserRole } from '@/lib/session';
import { getGuestCredentials } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const { username, password, role, path } = await request.json() as {
      username: string;
      password: string;
      role?: 'admin' | 'guest';
      path?: string; // For guest login, which path are they accessing
    };

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password';

    let authenticatedRole: UserRole;
    let authenticatedUsername: string;

    // Check if credentials match admin (regardless of role parameter)
    if (username === adminUsername && password === adminPassword) {
      authenticatedRole = 'admin';
      authenticatedUsername = username;
    }
    // Guest login
    else if (role === 'guest' && path) {
      // Get guest credentials for the requested path
      const guestCreds = await getGuestCredentials(path);
      
      if (!guestCreds) {
        return NextResponse.json({ 
          success: false, 
          message: 'Guest access not configured for this path' 
        }, { status: 401 });
      }
      
      if (username === guestCreds.username && password === guestCreds.password) {
        authenticatedRole = 'guest';
        authenticatedUsername = username;
      } else {
        return NextResponse.json({ 
          success: false, 
          message: 'Invalid guest credentials' 
        }, { status: 401 });
      }
    }
    else {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid credentials' 
      }, { status: 401 });
    }

    // Create a new session with role
    const { token, sessionData } = createSession(authenticatedUsername, authenticatedRole);
    
    // Set the session cookie
    await setSessionCookie(token);
    
    return NextResponse.json({ 
      success: true, 
      username: authenticatedUsername,
      role: authenticatedRole,
      expiresAt: sessionData.expiresAt 
    }, { status: 200 });
    
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'An error occurred during login.' 
    }, { status: 500 });
  }
}

