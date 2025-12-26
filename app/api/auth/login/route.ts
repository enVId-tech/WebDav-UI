import { NextRequest, NextResponse } from 'next/server';
import { createSession, setSessionCookie, UserRole } from '@/lib/session';
import { getAllPermissions } from '@/lib/permissions';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json() as {
      username: string;
      password: string;
    };

    console.log('Login attempt:', { username });

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password';

    let authenticatedRole!: UserRole;
    let authenticatedUsername!: string;

    // Always check admin credentials first
    if (username === adminUsername && password === adminPassword) {
      authenticatedRole = 'admin';
      authenticatedUsername = username;
    }
    // Check against all guest credentials
    else {
      const permissions = await getAllPermissions();
      let guestMatch = false;
      
      // Check if the provided credentials match any guest credentials
      for (const perm of permissions) {
        if (perm.guestCredentials?.username === username && 
            perm.guestCredentials?.password === password) {
          authenticatedRole = 'guest';
          authenticatedUsername = username;
          guestMatch = true;
          break;
        }
      }
      
      if (!guestMatch) {
        return NextResponse.json({ 
          success: false, 
          message: 'Invalid credentials' 
        }, { status: 401 });
      }
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