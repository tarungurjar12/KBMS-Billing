
"use client"; 

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase/firebaseConfig';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

/**
 * @fileOverview Main application layout for authenticated sections.
 * This layout includes the sidebar and main content area.
 * It primarily checks Firebase authentication state using `onAuthStateChanged`.
 * - If Firebase reports no user, and the current path is not '/login', it redirects to '/login'.
 *   This acts as a client-side fallback to the server-side middleware for route protection.
 * - If Firebase reports a user, it allows content rendering. The `userRole` cookie,
 *   set at login, is then used by `SidebarNav` and other components to tailor the UI.
 * It displays a loading skeleton while the Firebase auth state is being determined.
 */

/**
 * MainAppLayout component.
 * Wraps pages that require authentication, providing the sidebar and main content structure.
 * It handles client-side authentication checks and redirects.
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
   * Runs once on mount to set up the listener.
   * Updates `isAuthenticated` based on Firebase's report (user object exists or not).
   */
  useEffect(() => {
    console.log("MainAppLayout Mount: Subscribing to onAuthStateChanged.");
    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      console.log("MainAppLayout onAuthStateChanged: Firebase user:", user ? user.email : "null", "Current pathname:", pathname);
      if (user) {
        setIsAuthenticated(true);
        console.log("MainAppLayout onAuthStateChanged: User is authenticated via Firebase.");
      } else {
        setIsAuthenticated(false);
        console.log("MainAppLayout onAuthStateChanged: User is NOT authenticated via Firebase.");
      }
    });

    // Cleanup Firebase auth subscription on component unmount
    return () => {
      console.log("MainAppLayout Unmount: Unsubscribing from onAuthStateChanged.");
      unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only once on mount and unmount.

  /**
   * Effect hook to handle redirection based on the resolved `isAuthenticated` state.
   * This runs whenever `isAuthenticated`, `pathname`, or `router` changes.
   * It redirects to '/login' if the user is not authenticated and not already on the login page.
   */
  useEffect(() => {
    console.log("MainAppLayout Redirection useEffect: isAuthenticated:", isAuthenticated, "pathname:", pathname);
    // Only redirect if auth state is resolved to false (not null/loading)
    // and the user is not already on the login page.
    if (isAuthenticated === false && pathname !== '/login') {
      console.log("MainAppLayout Redirection useEffect: Auth state is false, not on login page. Redirecting to /login.");
      router.push('/login');
    }
  }, [isAuthenticated, pathname, router]);


  // Display loading skeleton while Firebase authentication status is being determined (isAuthenticated is null).
  // Avoid showing skeleton if already on the login page, as login page has its own UI.
  if (isAuthenticated === null && pathname !== '/login') {
    console.log("MainAppLayout: Auth state loading (isAuthenticated is null), showing skeleton.");
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
   * the `useEffect` hook above should have already initiated a redirect.
   * This return provides a fallback UI during that redirection process.
   * If on /login page, this layout shouldn't render this part; the login page handles itself.
   */
  if (isAuthenticated === false && pathname !== '/login') {
      console.log("MainAppLayout: Auth state is false, not on login page. Showing redirecting message (should be handled by useEffect).");
      return (
         <div className="flex min-h-screen w-full items-center justify-center bg-background">
            <p className="text-lg text-muted-foreground">Redirecting to login...</p>
         </div>
      );
  }

  // If authenticated via Firebase (`isAuthenticated === true`) and not on the login page, render the main app structure.
  if (isAuthenticated === true && pathname !== '/login') {
    console.log("MainAppLayout: User authenticated via Firebase, rendering main app structure.");
    return (
      <SidebarProvider defaultOpen> {/* Manages sidebar open/close state */}
        <Sidebar variant="sidebar" collapsible="icon" className="border-r">
          <SidebarNav /> {/* Renders navigation links based on user role (from cookie) */}
        </Sidebar>
        <SidebarRail /> {/* Handle for resizing/toggling sidebar on desktop */}
        <SidebarInset> {/* Main content area that adjusts with sidebar */}
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
            <SidebarTrigger className="md:hidden" /> {/* Hamburger icon for mobile to toggle sidebar */}
            {/* Future: Breadcrumbs or other global header content can be added here */}
          </header>
          <main className="flex-1 p-4 sm:p-6">
            {children} {/* Renders the current page's content */}
          </main>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  // If the current path IS the login page, just render the children directly.
  // This allows the LoginPage component to render without the MainAppLayout's sidebar structure.
  // This also covers the case where isAuthenticated might still be null but we're on /login.
  if (pathname === '/login') {
    console.log("MainAppLayout: Path is /login, rendering children (which should be LoginPage).");
    return <>{children}</>;
  }

  // Fallback rendering: If none of the above conditions are met (e.g., initial load on a protected page while auth is null,
  // but somehow not caught by skeleton), just render children to avoid breaking.
  // This is a safety net; ideally, other conditions handle all main scenarios.
  console.log("MainAppLayout: Fallback, rendering children. isAuthenticated:", isAuthenticated, "pathname:", pathname);
  return <>{children}</>;
}

