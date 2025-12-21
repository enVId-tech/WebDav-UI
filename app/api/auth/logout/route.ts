import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/session';

export async function POST() {
  try {
    // Clear the session cookie (JWT sessions are stateless, just remove cookie)
    await clearSessionCookie();
    
    return NextResponse.json({ success: true, message: 'Logged out successfully' }, { status: 200 });
  } catch (error) {
    console.error('Logout error:', error);
    
    // Still try to clear the cookie even if there's an error
    await clearSessionCookie();
    
    return NextResponse.json({ success: true, message: 'Logged out successfully' }, { status: 200 });
  }
}

