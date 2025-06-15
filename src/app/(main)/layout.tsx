
"use client"; 

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase/firebaseConfig'; // Firebase auth instance
import { onAuthStateChanged } from 'firebase/auth'; // Firebase auth function

/**
 * @fileOverview Main application layout for authenticated sections.
 * This layout includes the sidebar and main content area.
 * It primarily checks Firebase authentication state.
 * - If Firebase reports no user, and the current path is not '/login', it redirects to '/login'.
 *   This acts as a client-side fallback to the middleware.
 * - If Firebase reports a user, it allows content rendering. The `userRole` cookie,
 *   set at login, is then used by `SidebarNav` and potentially other components
 *   to tailor the UI. Middleware is the primary gatekeeper for route access based on this cookie.
 * It displays a loading skeleton while the Firebase auth state is being determined.
 */

/**
 * Helper function to get a cookie value by name.
 * @param {string} name - The name of the cookie.
 * @returns {string | undefined} The cookie value or undefined if not found.
 */
const getCookie = (name: string): string | undefined => {
  if (typeof window === 'undefined') return undefined; // Guard for SSR
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

/**
 * MainAppLayout component.
 * Wraps pages that require authentication, providing the sidebar and main content structure.
 * @param {React.ReactNode} children - The child React nodes to render within the layout.
 */
export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // isAuthenticated state: null (loading), true (auth'd), false (not auth'd)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  /**
   * Effect hook to listen for Firebase authentication state changes.
   * - Sets `isAuthenticated` based on Firebase's report.
   * - If Firebase indicates no authenticated user and the current path is not the login page,
   *   it redirects to the login page. This is a client-side safety net.
   * - The `userRole` cookie (set during login) is primarily used by middleware for route protection
   *   and by `SidebarNav` for displaying role-specific links. This layout doesn't need to
   *   re-verify the cookie for redirection if Firebase auth state is clear.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Firebase confirms a user is authenticated.
        setIsAuthenticated(true);
        // The userRole cookie should have been set at login.
        // Middleware handles route protection based on this cookie.
        // SidebarNav uses this cookie to render appropriate links.
        // No need for this layout to perform further redirection based on the cookie
        // if Firebase auth is established and middleware is active.
      } else {
        // Firebase confirms no user is authenticated.
        setIsAuthenticated(false);
        // If not on the login page, redirect to login.
        // This handles cases where a user's session might expire or they log out,
        // or if they try to access a protected route client-side without a session.
        if (pathname !== '/login') {
             router.push('/login');
        }
      }
    });

    // Cleanup Firebase auth subscription on component unmount
    return () => unsubscribe();
  }, [router, pathname]); // Dependencies for the effect

  // Display loading skeleton while Firebase authentication status is being determined.
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen w-full">
        <div className="hidden md:block border-r bg-muted/40 w-64 p-4 space-y-4">
            <Skeleton className="h-10 w-full" /> {/* Placeholder for Sidebar Header */}
            <Skeleton className="h-8 w-3/4" /> {/* Placeholder for Nav Item */}
            <Skeleton className="h-8 w-full" /> {/* Placeholder for Nav Item */}
            <Skeleton className="h-8 w-5/6" /> {/* Placeholder for Nav Item */}
        </div>
        <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-12 w-1/2" /> {/* Placeholder for PageHeader title */}
            <Skeleton className="h-32 w-full" /> {/* Placeholder for a card or content block */}
            <Skeleton className="h-64 w-full" /> {/* Placeholder for a larger content block/table */}
        </div>
      </div>
    );
  }
  
  /**
   * If Firebase reports not authenticated (`isAuthenticated === false`)
   * and the user is somehow not on the login page (e.g., client-side navigation attempt),
   * the `useEffect` above should have already initiated a redirect.
   * This return is a fallback UI during that redirection or if already on /login (which wouldn't use this layout).
   */
  if (isAuthenticated === false && pathname !== '/login') {
      return (
         <div className="flex min-h-screen w-full items-center justify-center">
            <p className="text-muted-foreground">Redirecting to login...</p>
         </div>
      );
  }

  // If authenticated via Firebase, render the main app layout with sidebar and content.
  return (
    <SidebarProvider defaultOpen> {/* Manages sidebar open/close state */}
      <Sidebar variant="sidebar" collapsible="icon" className="border-r">
        <SidebarNav /> {/* Renders navigation links based on user role */}
      </Sidebar>
      <SidebarRail /> {/* Handle for resizing/toggling sidebar */}
      <SidebarInset> {/* Main content area that adjusts with sidebar */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
          <SidebarTrigger className="md:hidden" /> {/* Hamburger icon for mobile */}
          {/* Future: Breadcrumbs or other header content can be added here */}
        </header>
        <main className="flex-1 p-4 sm:p-6">
          {children} {/* Renders the current page's content */}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
