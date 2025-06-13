
"use client"; // Needs to be client for auth check / redirect hook

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Skeleton } from '@/components/ui/skeleton';


// Basic cookie utility (can be moved to a utils file)
const getCookie = (name: string): string | undefined => {
  if (typeof window === 'undefined') return undefined; // Guard against SSR
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};


export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const authStatus = getCookie('authStatus');
    if (authStatus === 'loggedIn') {
      setIsAuthenticated(true);
    } else {
      // This check might be redundant due to middleware, but good as a fallback
      // router.push('/login'); 
      setIsAuthenticated(false); // Let middleware handle redirection mostly
    }
  }, [router]);

  // Show a loading state or skeleton while checking auth, to prevent flash of content
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

  // If not authenticated, middleware should have redirected.
  // This is a safety net or for scenarios where middleware might not cover everything.
  // However, rendering null or a message here might be better than a redirect from useEffect
  // if middleware is the primary guard. For now, rely on middleware.

  return (
    <SidebarProvider defaultOpen>
      <Sidebar variant="sidebar" collapsible="icon" className="border-r">
        <SidebarNav />
      </Sidebar>
      <SidebarRail />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
          <SidebarTrigger className="md:hidden" />
          {/* Breadcrumbs or other header content can go here */}
        </header>
        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
