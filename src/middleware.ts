
import { type NextRequest, NextResponse } from 'next/server';

/**
 * @fileOverview Next.js middleware for handling authentication and role-based access control.
 * This middleware checks for a 'userRole' cookie to determine if a user is authenticated
 * and what their role is (admin or store_manager). It protects routes by redirecting users
 * based on their authentication status and role.
 * It prioritizes redirecting unauthenticated users to the login page.
 */

// Define application paths for easier management and clarity
const ADMIN_DASHBOARD_PATH = '/';
const MANAGER_DASHBOARD_PATH = '/store-dashboard';
const LOGIN_PATH = '/login';

// Define routes accessible ONLY by users with the 'admin' role.
// The Admin Dashboard ('/') is implicitly admin-only if a manager tries to access it due to redirection logic.
const ADMIN_ONLY_PATHS = [
  '/managers',       // Manage Store Manager accounts
  '/sellers',        // Manage Seller/Supplier accounts
  '/products',       // Full CRUD on Product Database
  '/pricing-rules',  // Define and manage pricing rules
  '/stock',          // Manage overall inventory levels (manual adjustments)
  '/payments',       // Manage all payment records (customer and supplier)
  // '/billing' is accessible by both but Admin might see more comprehensive data or have more actions.
  // The Ledger page ('/ledger') is also accessible by both based on current SidebarNav.
];

// Define routes accessible ONLY by users with the 'store_manager' role.
const MANAGER_ONLY_PATHS = [
  // '/create-bill', // create-bill is shared, accessible via quick actions
  '/view-products-stock', // Read-only view of products and stock, can report issues
];

// Publicly accessible paths (no authentication required)
const PUBLIC_PATHS = [LOGIN_PATH]; // Login page is the primary public path

/**
 * Middleware function executed for matching requests.
 * 1. Retrieves 'userRole' cookie.
 * 2. Allows access to public assets (_next, api, static files) without auth checks.
 * 3. Handles redirection for the login page:
 *    - If an authenticated user (with a role) tries to access /login, redirect them to their dashboard.
 * 4. For all other (protected) routes:
 *    - If no 'userRole' cookie (unauthenticated), redirect to /login.
 *    - If 'userRole' cookie exists (authenticated):
 *      - Enforces role-based access:
 *        - Admins are redirected from manager-specific pages to their admin dashboard.
 *        - Managers are redirected from admin-specific pages (and the admin root dashboard) to their manager dashboard.
 * @param {NextRequest} request - The incoming Next.js request object.
 * @returns {NextResponse} The Next.js response (either proceeding or redirecting).
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next(); // Default: proceed with the request
  const { pathname } = request.nextUrl; // Current path

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
                        pathname.endsWith('.jpeg') || 
                        pathname.endsWith('.gif') || 
                        pathname.endsWith('.webp') ||
                        pathname.endsWith('.svg') ||
                        pathname.endsWith('.webmanifest');

  if (isPublicAsset) {
    return response; // Allow request for public assets
  }

  // Handle access to the login page
  if (pathname === LOGIN_PATH) {
    if (userRole === 'admin') {
      // If logged-in admin tries to access login, redirect to admin dashboard
      return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
    }
    if (userRole === 'store_manager') {
      // If logged-in manager tries to access login, redirect to manager dashboard
      return NextResponse.redirect(new URL(MANAGER_DASHBOARD_PATH, request.url));
    }
    // If no role or trying to access login page itself, allow
    return response;
  }
  
  // ---- Protected Route Logic ----
  // If no userRole cookie (user is not authenticated) and trying to access any route OTHER than login
  if (!userRole) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    // Optional: Add a 'redirectedFrom' query parameter for better UX after login
    // loginUrl.searchParams.set('redirectedFrom', pathname); 
    return NextResponse.redirect(loginUrl);
  }
  
  // Authenticated user: Apply role-based access control and redirections
  if (userRole) {
    // Admin specific redirections and access control
    if (userRole === 'admin') {
      // If admin tries to access the specific manager dashboard path
      if (pathname === MANAGER_DASHBOARD_PATH) {
        return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
      }
      // If admin tries to access a path designated exclusively for managers
      if (MANAGER_ONLY_PATHS.some(path => pathname.startsWith(path))) {
        return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
      }
    }

    // Store Manager specific redirections and access control
    if (userRole === 'store_manager') {
      // If manager tries to access the admin's root dashboard path
      if (pathname === ADMIN_DASHBOARD_PATH) {
        return NextResponse.redirect(new URL(MANAGER_DASHBOARD_PATH, request.url));
      }
      // If manager tries to access a path designated exclusively for admins
      if (ADMIN_ONLY_PATHS.some(path => pathname.startsWith(path))) {
        return NextResponse.redirect(new URL(MANAGER_DASHBOARD_PATH, request.url));
      }
    }
  }

  // If all checks pass (user is authenticated, has a role, and is accessing an appropriate page), allow the request.
  return response;
}

/**
 * Configuration for the middleware.
 * Specifies which paths the middleware should run on.
 * It aims to match all request paths except for specific static assets, API routes,
 * and image optimization files, to ensure it primarily runs on actual page requests.
 */
export const config = {
  matcher: [
    // Match all request paths except for the ones starting with:
    // - api (API routes)
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - static (custom static folder if used)
    // - specific file extensions (favicon, images, webmanifest)
    '/((?!api|_next/static|_next/image|static|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$|favicon.ico).*)',
  ],
};

