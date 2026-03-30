import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const accessToken = request.cookies.get('access_token');
  const { pathname } = request.nextUrl;

  // Protect dashboard routes — redirect to login if no access token
  if (pathname.startsWith('/dashboard')) {
    if (!accessToken) {
      const loginUrl = new URL('/auth/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Redirect authenticated users away from login/register
  if (pathname === '/auth/login' || pathname === '/auth/register') {
    if (accessToken) {
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*'],
};
