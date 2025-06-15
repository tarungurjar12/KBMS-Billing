
"use client"; 

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * @fileOverview Main application layout for authenticated sections.
 * This layout includes the sidebar and main content area.
 * It checks Firebase authentication state and displays a loading skeleton
 * or redirects to login if the user is not authenticated.
 */

/**
 * Retrieves a cookie value by name.
 * @param name - The name of the cookie.
 * @returns The cookie value or undefined if not found.
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
 * @param children - The child React nodes to render within the layout.
 */
export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null means loading

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        // Middleware should primarily handle role checks and redirection.
        // This client-side check is a fallback/UI update mechanism.
        const userRole = getCookie('userRole');
        if (!userRole && pathname !== '/login') { 
            // This case is unlikely if middleware is effective, but acts as a failsafe
            router.push('/login'); 
        }
      } else {
        setIsAuthenticated(false);
        // Middleware should have already redirected.
        // This client-side redirection is a fallback if middleware check was bypassed or failed.
        if (pathname !== '/login') { // Avoid redirect loop if already on login
             router.push('/login');
        }
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router, pathname]);

  // Display loading skeleton while checking authentication status
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen w-full">
        <div className="hidden md:block border-r bg-muted/40 w-64 p-4 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }
  
  // If not authenticated (and not on login page), middleware should handle this.
  // This is a client-side fallback.
  if (isAuthenticated === false && pathname !== '/login') {
      // router.push('/login') would have been called by onAuthStateChanged if needed.
      // Or return a "Redirecting..." message or null if preferred before redirect completes.
      return (
         <div className="flex min-h-screen w-full items-center justify-center">
            <p className="text-muted-foreground">Redirecting to login...</p>
         </div>
      );
  }

  // If authenticated, render the main app layout
  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon" className="border-r">
        <SidebarNav />
      </Sidebar>
      <SidebarRail />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
          <SidebarTrigger className="md:hidden" />
          {/* Future: Breadcrumbs or other header content can go here */}
        </header>
        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
