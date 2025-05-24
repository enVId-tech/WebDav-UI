import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // TODO: Implement actual authentication logic here
    if (username === 'admin' && password === 'password') {
      return NextResponse.json({ success: true, username }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
    }
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, message: 'An error occurred during login.' }, { status: 500 });
  }
}

