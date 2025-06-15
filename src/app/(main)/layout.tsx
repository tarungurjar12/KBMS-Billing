
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
  // isAuthenticated state: null (initial loading), true (auth'd), false (not auth'd)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  /**
   * Effect hook to listen for Firebase authentication state changes.
   * This effect runs once on mount and sets up the listener.
   * It updates `isAuthenticated` based on Firebase's report.
   */
  useEffect(() => {
    console.log("MainAppLayout useEffect: Subscribing to onAuthStateChanged.");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("MainAppLayout onAuthStateChanged: Firebase user:", user, "Current pathname:", pathname);
      if (user) {
        setIsAuthenticated(true);
        console.log("MainAppLayout onAuthStateChanged: User is authenticated.");
      } else {
        setIsAuthenticated(false);
        console.log("MainAppLayout onAuthStateChanged: User is NOT authenticated.");
      }
    });

    // Cleanup Firebase auth subscription on component unmount
    return () => {
      console.log("MainAppLayout useEffect: Unsubscribing from onAuthStateChanged.");
      unsubscribe();
    };
  }, []); // Empty dependency array: runs only on mount and unmount.

  /**
   * Effect hook to handle redirection based on the resolved `isAuthenticated` state.
   * This runs whenever `isAuthenticated`, `pathname`, or `router` changes.
   */
  useEffect(() => {
    console.log("MainAppLayout Redirection useEffect: isAuthenticated:", isAuthenticated, "pathname:", pathname);
    // Only redirect if auth state is resolved (not null) and user is not authenticated,
    // and not already on the login page.
    if (isAuthenticated === false && pathname !== '/login') {
      console.log("MainAppLayout Redirection useEffect: Redirecting to /login.");
      router.push('/login');
    }
  }, [isAuthenticated, pathname, router]);


  // Display loading skeleton while Firebase authentication status is being determined (isAuthenticated is null).
  // Do not show skeleton if on login page, as login page has its own UI.
  if (isAuthenticated === null && pathname !== '/login') {
    console.log("MainAppLayout: Auth state loading, showing skeleton.");
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
   * This return is a fallback UI during that redirection.
   * If on /login page, this layout shouldn't render this part, login page handles itself.
   */
  if (isAuthenticated === false && pathname !== '/login') {
      console.log("MainAppLayout: Auth state false, not on login page, showing redirecting message (should be handled by useEffect).");
      return (
         <div className="flex min-h-screen w-full items-center justify-center">
            <p className="text-muted-foreground">Redirecting to login...</p>
         </div>
      );
  }

  // If authenticated via Firebase, or if on the login page itself, render the layout.
  // The login page doesn't use the Sidebar, so this structure is for authenticated routes.
  if (isAuthenticated === true && pathname !== '/login') {
    console.log("MainAppLayout: User authenticated, rendering main app structure.");
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

  // If on the login page, just render children (which is the LoginPage component).
  // This case handles when this layout might wrap the login page directly (though typically it doesn't).
  // More robustly, the login page should not use this MainAppLayout.
  // This logic path assumes the router might place the login page under this layout.
  // For a cleaner separation, the login page should have its own minimal layout or no layout from here.
  // However, given the file structure (login is outside /main), this check might be for robustness.
  if (pathname === '/login') {
    console.log("MainAppLayout: Path is /login, rendering children (LoginPage).");
    return <>{children}</>;
  }

  // Fallback: if isAuthenticated is null (still loading) but on login page, or some other unexpected state.
  // This helps prevent rendering the full layout on the login page if auth state is still pending.
  console.log("MainAppLayout: Fallback, rendering children. isAuthenticated:", isAuthenticated, "pathname:", pathname);
  return <>{children}</>; // Default fallback if no other condition met, effectively rendering the page content.
}
