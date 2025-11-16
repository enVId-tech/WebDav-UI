import { NextResponse } from 'next/server';
import { getCurrentSession, extendSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getCurrentSession();
    
    if (session) {
      // Extend session on activity
      extendSession(session.token);
      
      return NextResponse.json({ 
        loggedIn: true, 
        username: session.username,
        expiresAt: session.expiresAt 
      }, { status: 200 });
    } else {
      return NextResponse.json({ loggedIn: false }, { status: 200 });
    }
  } catch (error) {
    console.error('Session status check error:', error);
    return NextResponse.json({ loggedIn: false }, { status: 200 });
  }
}

