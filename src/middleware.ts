
import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // Attempt to get userRole cookie. This is set after successful Firebase login.
  const userRoleCookie = request.cookies.get('userRole');
  const userRole = userRoleCookie?.value;

  // Allow access to static files, API routes, and the login page itself without auth check
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.startsWith('/static') || pathname.endsWith('.ico') || pathname.endsWith('.png') || pathname.endsWith('.jpg') || pathname.endsWith('.svg') || pathname === '/login') {
    // If trying to access login page BUT a userRole cookie exists (meaning they are likely logged in)
    if (pathname === '/login' && userRole) {
      if (userRole === 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
      }
      if (userRole === 'store_manager') {
        return NextResponse.redirect(new URL('/store-dashboard', request.url));
      }
      // Fallback if role is somehow not set but logged in via cookie
      return NextResponse.redirect(new URL('/', request.url));
    }
    return response;
  }
  
  // If no userRole cookie (meaning not logged in via Firebase) and trying to access a protected route
  if (!userRole && pathname !== '/login') {
    const loginUrl = new URL('/login', request.url);
    // loginUrl.searchParams.set('redirectedFrom', pathname); // Optional: add redirect info
    return NextResponse.redirect(loginUrl);
  }
  
  // Role-based dashboard redirection if user lands on a generic path with an active session (role cookie)
  if (userRole) {
    if (pathname === '/' && userRole === 'store_manager') {
        return NextResponse.redirect(new URL('/store-dashboard', request.url));
    }
    // Admin users are generally fine on '/' if that's their main dashboard.
    // Add specific checks if admin should not access certain store_manager pages or vice-versa
    if (userRole === 'admin' && (pathname.startsWith('/store-dashboard') || pathname.startsWith('/create-bill') || pathname.startsWith('/view-products-stock') || pathname.startsWith('/my-profile') )) {
        return NextResponse.redirect(new URL('/', request.url)); // Redirect admin away from manager-only pages
    }
    if (userRole === 'store_manager' && (pathname.startsWith('/managers') || pathname.startsWith('/sellers') || pathname.startsWith('/products') || pathname.startsWith('/pricing-rules') || pathname.startsWith('/stock') || pathname.startsWith('/billing') || pathname.startsWith('/payments') )) {
        if(pathname !== '/customers') { // allow /customers for store manager
             return NextResponse.redirect(new URL('/store-dashboard', request.url)); // Redirect manager away from admin-only pages
        }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, etc.)
     * This matcher aims to run middleware on actual pages.
     */
    '/((?!api|_next/static|_next/image|static|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|favicon.ico).*)',
  ],
};
