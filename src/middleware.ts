
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

// Publicly accessible paths (no authentication required or handled within the page)
const PUBLIC_PATHS = [LOGIN_PATH, REGISTER_ADMIN_PATH]; 

/**
 * Middleware function executed for matching requests.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next(); 
  const { pathname } = request.nextUrl; 

  const userRoleCookie = request.cookies.get('userRole');
  const userRole = userRoleCookie?.value as 'admin' | 'store_manager' | undefined;

  // Allow access to static files, Next.js internal routes, and API routes
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

  // Handle access to login and admin registration pages
  if (pathname === LOGIN_PATH || pathname === REGISTER_ADMIN_PATH) {
    if (userRole === 'admin') {
      return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
    }
    if (userRole === 'store_manager') {
      return NextResponse.redirect(new URL(MANAGER_DASHBOARD_PATH, request.url));
    }
    // Allow access if no role or trying to access login/register page itself
    return response;
  }
  
  // ---- Protected Route Logic ----
  // If no userRole cookie (user is not authenticated) and trying to access any route OTHER than login/register
  if (!userRole) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    return NextResponse.redirect(loginUrl);
  }
  
  // Authenticated user: Apply role-based access control
  if (userRole) {
    if (userRole === 'admin') {
      if (pathname === MANAGER_DASHBOARD_PATH || MANAGER_ONLY_PATHS.some(path => pathname.startsWith(path))) {
        return NextResponse.redirect(new URL(ADMIN_DASHBOARD_PATH, request.url));
      }
    }

    if (userRole === 'store_manager') {
      if (pathname === ADMIN_DASHBOARD_PATH || ADMIN_ONLY_PATHS.some(path => pathname.startsWith(path))) {
        return NextResponse.redirect(new URL(MANAGER_DASHBOARD_PATH, request.url));
      }
    }
  }

  return response;
}

/**
 * Configuration for the middleware.
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|static|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$|favicon.ico).*)',
  ],
};

    
