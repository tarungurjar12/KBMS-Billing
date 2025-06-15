
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = await createClient(request, response);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;
  const userRole = request.cookies.get('userRole')?.value; // Still using this for quick role checks

  // If trying to access login page while already logged in via Supabase session
  if (pathname === '/login' && session) {
    if (userRole === 'admin') {
      return NextResponse.redirect(new URL('/', request.url), { headers: response.headers });
    }
    if (userRole === 'store_manager') {
      return NextResponse.redirect(new URL('/store-dashboard', request.url), { headers: response.headers });
    }
    // Fallback if role is somehow not set but logged in
    return NextResponse.redirect(new URL('/', request.url), { headers: response.headers });
  }

  // Allow access to static files and API routes without auth check
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname === '/login') {
    return response;
  }
  
  // If no Supabase session and trying to access a protected route
  if (!session && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url), { headers: response.headers });
  }
  
  // Role-based dashboard redirection if user lands on a generic path with an active session
  if (session) {
    if (pathname === '/' && userRole === 'store_manager') {
        return NextResponse.redirect(new URL('/store-dashboard', request.url), { headers: response.headers });
    }
    // Admins are fine on '/'
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
     * - public assets
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
