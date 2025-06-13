
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authStatus = request.cookies.get('authStatus')?.value;
  const userRole = request.cookies.get('userRole')?.value;

  // If trying to access login page while already logged in, redirect to appropriate dashboard
  if (pathname === '/login' && authStatus === 'loggedIn') {
    if (userRole === 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (userRole === 'store_manager') {
      return NextResponse.redirect(new URL('/store-dashboard', request.url));
    }
    // Fallback if role is somehow not set but logged in
    return NextResponse.redirect(new URL('/', request.url)); 
  }

  // Protect all routes under / (main app routes) except /login
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/login') {
    return NextResponse.next();
  }
  
  // If not logged in and trying to access a protected route
  if (authStatus !== 'loggedIn' && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // Role-based dashboard redirection if user lands on a generic path
  if (authStatus === 'loggedIn') {
    if (pathname === '/' && userRole === 'store_manager') {
        return NextResponse.redirect(new URL('/store-dashboard', request.url));
    }
    // Admins are fine on '/'
  }


  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
