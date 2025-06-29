
import { type NextRequest, NextResponse } from 'next/server';

/**
 * @fileOverview Next.js middleware for handling authentication and role-based access control.
 * This middleware inspects incoming requests and uses a 'userRole' cookie to determine
 * if a user is authenticated and what their role is (e.g., 'admin' or 'store_manager').
 * It protects routes by redirecting users based on their authentication status and role,
 * ensuring that users can only access pages they are authorized to see.
 */

// Define application paths for easier management and to avoid magic strings.
const ADMIN_DASHBOARD_PATH = '/';
const MANAGER_DASHBOARD_PATH = '/store-dashboard';
const LOGIN_PATH = '/login';
const REGISTER_ADMIN_PATH = '/register-admin';

// Define routes accessible ONLY by users with the 'admin' role.
const ADMIN_ONLY_PATHS = [
  '/managers',       
  '/sellers',        
  '/products',       
  '/pricing-rules',  
  '/stock',          
  '/payments',       
];

// Define routes accessible ONLY by users with the 'store_manager' role.
const MANAGER_ONLY_PATHS = [
  '/view-products-stock', 
];

/**
 * Middleware function executed for every request that matches the `config.matcher`.
 * @param {NextRequest} request - The incoming request object.
 * @returns {Promise<NextResponse>} The response, which may be a redirect or the original request.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next(); 
  const { pathname } = request.nextUrl; 

  // Retrieve the user's role from the cookie.
  const userRoleCookie = request.cookies.get('userRole');
  const userRole = userRoleCookie?.value as 'admin' | 'store_manager' | undefined;

  // Rule: Allow access to static files and Next.js internal routes without checks.
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
    return response; 
  }

  // Rule: Handle authenticated users trying to access login/register pages.
  if (pathname === LOGIN_PATH || pathname === REGISTER_ADMIN_PATH) {
    if (userRole === 'admin') {
      // If an admin is logged in, redirect them to their dashboard.
      return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
    }
    if (userRole === 'store_manager') {
      // If a manager is logged in, redirect them to their dashboard.
      return NextResponse.redirect(new URL(MANAGER_DASHBOARD_PATH, request.url));
    }
    // If no role or already on the correct page, allow access.
    return response;
  }
  
  // --- Protected Route Logic ---

  // Rule: If a user is not authenticated (no role cookie), redirect them to the login page.
  if (!userRole) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    return NextResponse.redirect(loginUrl);
  }
  
  // Rule: Apply role-based access control for authenticated users.
  if (userRole) {
    // Admin trying to access manager-only pages.
    if (userRole === 'admin') {
      if (pathname === MANAGER_DASHBOARD_PATH || MANAGER_ONLY_PATHS.some(path => pathname.startsWith(path))) {
        return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
      }
    }

    // Manager trying to access admin-only pages.
    if (userRole === 'store_manager') {
      if (pathname === ADMIN_DASHBOARD_PATH || ADMIN_ONLY_PATHS.some(path => pathname.startsWith(path))) {
        return NextResponse.redirect(new URL(MANAGER_DASHBOARD_PATH, request.url));
      }
    }
  }

  // If none of the above rules match, allow the request to proceed.
  return response;
}

/**
 * Configuration for the middleware.
 * `matcher` specifies which paths the middleware should run on.
 * The regex excludes API routes, static files, and image assets.
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|static|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$|favicon.ico).*)',
  ],
};
