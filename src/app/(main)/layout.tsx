
"use client"; 

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

// Basic cookie utility
const getCookie = (name: string): string | undefined => {
  if (typeof window === 'undefined') return undefined;
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
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null means loading

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthenticated(true);
        // Role check could also happen here if needed, or rely on cookie set at login
        const userRole = getCookie('userRole');
        if (!userRole && pathname !== '/login') { // If somehow auth state is true but no role, redirect
            router.push('/login');
        }
      } else {
        setIsAuthenticated(false);
        // Middleware should handle actual redirection. 
        // This is more of a client-side state update or fallback.
        if (pathname !== '/login') {
             router.push('/login');
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [router, pathname]);

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
  // This client-side check is a fallback.
  if (isAuthenticated === false && pathname !== '/login') {
      // router.push('/login') would have been called by onAuthStateChanged
      // Or we can return null / specific loading state if preferred before redirect fully happens
      return (
         <div className="flex min-h-screen w-full items-center justify-center">
            <p>Redirecting to login...</p>
         </div>
      );
  }


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
