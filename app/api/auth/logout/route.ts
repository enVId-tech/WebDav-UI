import { NextResponse } from 'next/server';
import { getCurrentSession, deleteSession, clearSessionCookie } from '@/lib/session';

export async function POST() {
  try {
    // Get the current session
    const session = await getCurrentSession();
    
    if (session) {
      // Delete the session from the store
      deleteSession(session.token);
    }
    
    // Clear the session cookie regardless
    await clearSessionCookie();
    
    return NextResponse.json({ success: true, message: 'Logged out successfully' }, { status: 200 });
  } catch (error) {
    console.error('Logout error:', error);
    
    // Still try to clear the cookie even if there's an error
    await clearSessionCookie();
    
    return NextResponse.json({ success: true, message: 'Logged out successfully' }, { status: 200 });
  }
}

