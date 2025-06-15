
import { type NextRequest, NextResponse } from 'next/server';

/**
 * @fileOverview Next.js middleware for handling authentication and role-based access control.
 * This middleware checks for a 'userRole' cookie to determine if a user is authenticated
 * and what their role is (admin or store_manager). It protects routes by redirecting users
 * based on their authentication status and role.
 */

// Define application paths for easier management
const ADMIN_DASHBOARD_PATH = '/';
const MANAGER_DASHBOARD_PATH = '/store-dashboard';
const LOGIN_PATH = '/login';

// Define routes accessible only by users with the 'admin' role.
// Note: The Admin Dashboard ('/') is implicitly admin-only if a manager tries to access it.
const ADMIN_ONLY_PATHS = [
  '/managers',
  '/sellers',
  '/products',
  '/pricing-rules',
  '/stock',
  '/billing',        // Admin has full billing capabilities
  '/payments',       // Admin manages all payment records
];

// Define routes accessible only by users with the 'store_manager' role.
const MANAGER_ONLY_PATHS = [
  '/create-bill',         // Managers can create bills
  '/view-products-stock', // Managers can view products and stock (read-only)
];

// Routes accessible by both admin and store_manager.
// Specific content or permissions within these pages might be handled client-side.
// Examples: '/customers' (admin has full CRUD, manager might have limited view/add),
// '/my-profile' (common to both roles).
// For this middleware, we primarily focus on gating access to entire route segments.
// const SHARED_PATHS_WITH_CLIENT_RBAC = ['/customers', '/my-profile']; // Not directly used for redirection logic here, but for context.


/**
 * Middleware function executed for matching requests.
 * 1. Retrieves 'userRole' cookie.
 * 2. Allows access to public assets and API routes without auth checks.
 * 3. Handles redirection for the login page:
 *    - If an authenticated user (with a role) tries to access /login, redirect them to their dashboard.
 * 4. For all other routes:
 *    - If no 'userRole' cookie (unauthenticated), redirect to /login.
 *    - If 'userRole' cookie exists (authenticated):
 *      - Enforces role-based access:
 *        - Admins are redirected from manager-only pages to their dashboard.
 *        - Managers are redirected from admin-only pages (and the admin dashboard) to their dashboard.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @returns {NextResponse} The Next.js response (either proceeding or redirecting).
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next(); // Default response: proceed with the request
  const { pathname } = request.nextUrl; // Get the current path

  // Retrieve 'userRole' cookie
  const userRoleCookie = request.cookies.get('userRole');
  const userRole = userRoleCookie?.value as 'admin' | 'store_manager' | undefined;

  // Allow access to static files, Next.js internal routes, and API routes without auth check
  const isPublicAsset = pathname.startsWith('/_next') || 
                        pathname.startsWith('/api') || 
                        pathname.startsWith('/static') || 
                        pathname.endsWith('.ico') || 
                        pathname.endsWith('.png') || 
                        pathname.endsWith('.jpg') || 
                        pathname.endsWith('.svg') ||
                        pathname.endsWith('.webmanifest'); // Added for PWA manifest if used

  if (isPublicAsset) {
    return response; // Allow the request to proceed
  }

  // Handle access to the login page
  if (pathname === LOGIN_PATH) {
    if (userRole === 'admin') {
      // If admin is logged in and tries to access login page, redirect to admin dashboard
      return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
    }
    if (userRole === 'store_manager') {
      // If manager is logged in and tries to access login page, redirect to manager dashboard
      return NextResponse.redirect(new URL(MANAGER_DASHBOARD_PATH, request.url));
    }
    // If no role or trying to access login, allow (unless already handled by above)
    return response;
  }
  
  // If no userRole cookie (user is not authenticated) and trying to access any other protected route
  if (!userRole) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    // Optional: Add a query parameter to redirect back to the original page after login for better UX
    // loginUrl.searchParams.set('redirectedFrom', pathname); 
    return NextResponse.redirect(loginUrl);
  }
  
  // Authenticated user: Apply role-based access control and redirections
  if (userRole) {
    // If an admin is somehow on the manager's dashboard path, redirect them to the admin dashboard.
    if (userRole === 'admin' && pathname === MANAGER_DASHBOARD_PATH) {
        return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
    }
    // If a store manager is on the admin's root dashboard path, redirect them to the manager's dashboard.
    if (userRole === 'store_manager' && pathname === ADMIN_DASHBOARD_PATH) {
        return NextResponse.redirect(new URL(MANAGER_DASHBOARD_PATH, request.url));
    }

    // Admin-specific route protection
    if (userRole === 'admin') {
      // If admin tries to access a path designated as manager-only
      if (MANAGER_ONLY_PATHS.some(path => pathname.startsWith(path))) {
        return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
      }
    }

    // Store Manager-specific route protection
    if (userRole === 'store_manager') {
      // If manager tries to access a path designated as admin-only
      if (ADMIN_ONLY_PATHS.some(path => pathname.startsWith(path))) {
        return NextResponse.redirect(new URL(MANAGER_DASHBOARD_PATH, request.url));
      }
    }
  }

  // If all checks pass, allow the request to proceed
  return response;
}

/**
 * Configuration for the middleware.
 * Specifies which paths the middleware should run on.
 * It aims to match all request paths except for specific static assets, API routes,
 * and image optimization files to ensure it primarily runs on actual page requests.
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|static|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$|favicon.ico).*)',
  ],
};
