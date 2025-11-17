import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, extendSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    
    if (session) {
      // Extend session on activity
      extendSession(session.token);
      
      console.log('[auth/status] User authenticated:', session.username, 'Role:', session.role);
      
      return NextResponse.json({ 
        loggedIn: true, 
        username: session.username,
        role: session.role,
        expiresAt: session.expiresAt 
      }, { status: 200 });
    } else {
      console.log('[auth/status] No valid session found');
      return NextResponse.json({ loggedIn: false }, { status: 200 });
    }
  } catch (error) {
    console.error('Session status check error:', error);
    return NextResponse.json({ loggedIn: false }, { status: 200 });
  }
}

