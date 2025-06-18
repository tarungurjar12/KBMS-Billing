
"use client"; 

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { auth, db } from '@/lib/firebase/firebaseConfig'; // Added db
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore'; // Added getDoc
import type { UserProfile } from './my-profile/page'; // For role type

/**
 * @fileOverview Main application layout for authenticated sections.
 */

const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

const setCookie = (name: string, value: string, days: number) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  if (typeof document !== 'undefined') {
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
    window.dispatchEvent(new CustomEvent('userRoleChanged'));
  }
};

const deleteCookie = (name: string) => {
    if (typeof document !== 'undefined') {
        document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        window.dispatchEvent(new CustomEvent('userRoleChanged'));
    }
};


export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentRole, setCurrentRole] = useState<UserProfile['role'] | undefined>(undefined);

  const verifyAndSetRole = useCallback(async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      let roleFromCookie = getCookie('userRole') as UserProfile['role'];
      if (roleFromCookie) {
        setCurrentRole(roleFromCookie);
        setIsAuthenticated(true);
        console.log("MainAppLayout verifyAndSetRole: Role from cookie:", roleFromCookie);
      } else {
        // If no cookie, try to fetch role from Firestore
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const firestoreRole = userDocSnap.data()?.role as UserProfile['role'];
            if (firestoreRole) {
              setCookie('userRole', firestoreRole, 1); // Set cookie if found in Firestore
              setCurrentRole(firestoreRole);
              setIsAuthenticated(true);
              console.log("MainAppLayout verifyAndSetRole: Role from Firestore:", firestoreRole);
            } else {
              // User doc exists but no role field or invalid role
              setIsAuthenticated(false); // Treat as not properly authenticated for app purposes
              setCurrentRole(undefined);
              deleteCookie('userRole');
              console.warn("MainAppLayout verifyAndSetRole: User doc found but role missing/invalid. Redirecting to login.");
              if (pathname !== '/login') router.push('/login');
            }
          } else {
            // No user document in Firestore, user might be from Auth but not in our system
            setIsAuthenticated(false);
            setCurrentRole(undefined);
            deleteCookie('userRole');
            console.warn("MainAppLayout verifyAndSetRole: No user document in Firestore. Redirecting to login.");
            if (pathname !== '/login') router.push('/login');
          }
        } catch (error) {
          console.error("MainAppLayout verifyAndSetRole: Error fetching user role from Firestore:", error);
          setIsAuthenticated(false);
          setCurrentRole(undefined);
          deleteCookie('userRole');
          if (pathname !== '/login') router.push('/login');
        }
      }
    } else { // No Firebase user
      setIsAuthenticated(false);
      setCurrentRole(undefined);
      deleteCookie('userRole');
      console.log("MainAppLayout verifyAndSetRole: No Firebase user. Redirecting to login.");
      if (pathname !== '/login') router.push('/login');
    }
  }, [pathname, router]);


  useEffect(() => {
    console.log("MainAppLayout Mount: Subscribing to onAuthStateChanged.");
    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      console.log("MainAppLayout onAuthStateChanged: Firebase user:", user ? user.email : "null", "Current pathname:", pathname);
      verifyAndSetRole(user);
    });
    
    const handleRoleChanged = () => {
        console.log("MainAppLayout: 'userRoleChanged' event received. Re-verifying role.");
        verifyAndSetRole(auth.currentUser); // Re-check with current Firebase user
    };
    window.addEventListener('userRoleChanged', handleRoleChanged);

    return () => {
      console.log("MainAppLayout Unmount: Unsubscribing from onAuthStateChanged.");
      unsubscribe();
      window.removeEventListener('userRoleChanged', handleRoleChanged);
    };
  }, [verifyAndSetRole, pathname]); // Added pathname to re-check if navigation occurs before auth state resolves

  if (isAuthenticated === null && pathname !== '/login') {
    console.log("MainAppLayout: Auth state loading (isAuthenticated is null), showing skeleton.");
    return (
      <div className="flex min-h-screen w-full">
        <div className="hidden md:block border-r bg-muted/40 w-64 p-4 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-5/6" />
        </div>
        <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }
  
  if (isAuthenticated === false && pathname !== '/login') {
      console.log("MainAppLayout: Auth state is false, not on login page. Showing redirecting message.");
      return (
         <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            <p className="text-lg text-muted-foreground">Redirecting to login...</p>
         </div>
      );
  }

  if (isAuthenticated === true && pathname !== '/login' && currentRole) {
    console.log("MainAppLayout: User authenticated, rendering main app structure for role:", currentRole);
    return (
      <SidebarProvider defaultOpen> 
        <Sidebar variant="sidebar" collapsible="icon" className="border-r">
          <SidebarNav /> 
        </Sidebar>
        <SidebarRail /> 
        <SidebarInset> 
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 sm:py-4">
            <SidebarTrigger className="md:hidden" /> 
          </header>
          <main className="flex-1 p-4 sm:p-6">
            {children} 
          </main>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  if (pathname === '/login') {
    console.log("MainAppLayout: Path is /login, rendering children (LoginPage).");
    return <>{children}</>;
  }

  console.log("MainAppLayout: Fallback rendering. isAuthenticated:", isAuthenticated, "pathname:", pathname, "role:", currentRole);
  return ( // Fallback loading state or if role determination is pending but auth is true
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Loading application...</p>
    </div>
  );
}
