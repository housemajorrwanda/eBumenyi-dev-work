import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected routes that require authentication
const protectedRoutes = [
  '/',
  '/upcoming',
  '/previous',
  '/recordings',
  '/personal-room',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get token from cookies
  const token = request.cookies.get('auth_token')?.value;

  // Check if this is an auth route (sign-in or sign-up)
  const isAuthRoute = pathname.includes('/sign-in') || pathname.includes('/sign-up');

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || (route === '/' ? false : pathname.startsWith(route))
  );

  // Allow meeting routes (e.g., /meeting/[id]) for both authenticated and unauthenticated users
  const isMeetingRoute = pathname.startsWith('/meeting');

  // If user has token and tries to access auth routes, redirect to home
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // If accessing a protected route without token, redirect to sign-in
  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  // Allow everything else
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};
