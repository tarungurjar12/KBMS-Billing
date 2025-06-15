
import { type NextRequest, NextResponse } from 'next/server';

/**
 * @fileOverview Next.js middleware for handling authentication and role-based access.
 * This middleware checks for a 'userRole' cookie to determine if a user is authenticated
 * and what their role is. It protects routes and redirects users accordingly.
 */

const ADMIN_DASHBOARD_PATH = '/';
const MANAGER_DASHBOARD_PATH = '/store-dashboard';
const LOGIN_PATH = '/login';

// Routes accessible only by admin
const ADMIN_ONLY_PATHS = [
  '/managers',
  '/sellers',
  '/products',
  '/pricing-rules',
  '/stock',
  '/billing',
  '/payments',
];

// Routes accessible only by store_manager
const MANAGER_ONLY_PATHS = [
  '/create-bill',
  '/view-products-stock',
];

// Routes accessible by both but might have different content/permissions handled client-side
const SHARED_PATHS_WITH_CLIENT_RBAC = ['/customers', '/my-profile'];


export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // Retrieve 'userRole' cookie
  const userRoleCookie = request.cookies.get('userRole');
  const userRole = userRoleCookie?.value as 'admin' | 'store_manager' | undefined;

  // Allow access to static files, API routes, and the login page itself without auth check
  const isPublicAsset = pathname.startsWith('/_next') || 
                        pathname.startsWith('/api') || 
                        pathname.startsWith('/static') || 
                        pathname.endsWith('.ico') || 
                        pathname.endsWith('.png') || 
                        pathname.endsWith('.jpg') || 
                        pathname.endsWith('.svg');

  if (isPublicAsset) {
    return response;
  }

  // Handle access to the login page
  if (pathname === LOGIN_PATH) {
    if (userRole === 'admin') {
      return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
    }
    if (userRole === 'store_manager') {
      return NextResponse.redirect(new URL(MANAGER_DASHBOARD_PATH, request.url));
    }
    // If no role or trying to access login, allow (unless already handled by above)
    return response;
  }
  
  // If no userRole cookie (not authenticated) and trying to access a protected route
  if (!userRole) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    // Optional: Add redirect info for a better UX after login
    // loginUrl.searchParams.set('redirectedFrom', pathname); 
    return NextResponse.redirect(loginUrl);
  }
  
  // Authenticated user: Role-based redirection and access control
  if (userRole) {
    // Redirect to correct dashboard if user lands on a generic path
    if (pathname === '/' && userRole === 'store_manager') {
      return NextResponse.redirect(new URL(MANAGER_DASHBOARD_PATH, request.url));
    }
    if ((pathname === ADMIN_DASHBOARD_PATH || pathname === MANAGER_DASHBOARD_PATH) && userRole === 'admin' && pathname !== ADMIN_DASHBOARD_PATH) {
        // If admin is somehow on manager dashboard, redirect to admin dashboard
        return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
    }


    // Admin access control
    if (userRole === 'admin') {
      if (MANAGER_ONLY_PATHS.some(path => pathname.startsWith(path))) {
        // Admin trying to access manager-only page
        return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
      }
    }

    // Store Manager access control
    if (userRole === 'store_manager') {
      if (ADMIN_ONLY_PATHS.some(path => pathname.startsWith(path))) {
         // Manager trying to access admin-only page
        return NextResponse.redirect(new URL(MANAGER_DASHBOARD_PATH, request.url));
      }
      // Special case for admin dashboard access by manager
      if (pathname === ADMIN_DASHBOARD_PATH) {
        return NextResponse.redirect(new URL(MANAGER_DASHBOARD_PATH, request.url));
      }
    }
  }

  // If all checks pass, allow the request
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
