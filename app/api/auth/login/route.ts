import { NextRequest, NextResponse } from 'next/server';
import { createSession, setSessionCookie } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password';

    if (username === adminUsername && password === adminPassword) {
      // Create a new session
      const session = createSession(username);
      
      // Set the session cookie
      await setSessionCookie(session.token);
      
      return NextResponse.json({ 
        success: true, 
        username,
        expiresAt: session.expiresAt 
      }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: 'An error occurred during login.' }, { status: 500 });
  }
}

