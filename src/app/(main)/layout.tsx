
"use client"; 

import React, { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarRail } from '@/components/ui/sidebar';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { Skeleton } from '@/components/ui/skeleton';
import { auth, db } from '@/lib/firebase/firebaseConfig';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile } from './my-profile/page';

export interface AppContextType {
  userRole: UserProfile['role'] | undefined;
  companyId: string | undefined;
  firebaseUser: FirebaseUser | null;
}

const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppContextProvider");
  }
  return context;
};

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
    // Dispatch event after cookie is set to ensure other components can react
    window.dispatchEvent(new CustomEvent('userSessionChanged'));
  }
};

const deleteCookie = (name: string) => {
    if (typeof document !== 'undefined') {
        document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        window.dispatchEvent(new CustomEvent('userSessionChanged'));
    }
};


export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [currentRole, setCurrentRole] = useState<UserProfile['role'] | undefined>(undefined);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | undefined>(undefined);
  const [currentFirebaseUser, setCurrentFirebaseUser] = useState<FirebaseUser | null>(null);


  const verifyAndSetSession = useCallback(async (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      setCurrentFirebaseUser(firebaseUser);
      let roleFromCookie = getCookie('userRole') as UserProfile['role'];
      let companyIdFromCookie = getCookie('companyId');

      if (roleFromCookie && companyIdFromCookie) {
        setCurrentRole(roleFromCookie);
        setCurrentCompanyId(companyIdFromCookie);
        setAuthStatus('authenticated');
        console.log("MainAppLayout verifyAndSetSession (from cookie): Role:", roleFromCookie, "CompanyID:", companyIdFromCookie);
      } else {
        console.log("MainAppLayout verifyAndSetSession: Cookies missing or incomplete, fetching from Firestore for UID:", firebaseUser.uid);
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            const firestoreRole = userData?.role as UserProfile['role'];
            const firestoreCompanyId = userData?.companyId as string;

            if (firestoreRole && firestoreCompanyId) {
              setCookie('userRole', firestoreRole, 1);
              setCookie('companyId', firestoreCompanyId, 1);
              setCurrentRole(firestoreRole);
              setCurrentCompanyId(firestoreCompanyId);
              setAuthStatus('authenticated');
              console.log("MainAppLayout verifyAndSetSession (from Firestore): Role:", firestoreRole, "CompanyID:", firestoreCompanyId);
            } else {
              console.warn("MainAppLayout verifyAndSetSession: User doc found but role/companyId missing/invalid in Firestore. UID:", firebaseUser.uid, "Data:", userData);
              setAuthStatus('unauthenticated'); 
              setCurrentRole(undefined); setCurrentCompanyId(undefined); // No setCurrentFirebaseUser(null) here, as auth is still valid
              deleteCookie('userRole'); deleteCookie('companyId');
              if (pathname !== '/login' && pathname !== '/register-admin') router.push('/login');
            }
          } else {
            console.warn("MainAppLayout verifyAndSetSession: No user document in Firestore for UID:", firebaseUser.uid);
            if (pathname !== '/register-admin' && pathname !== '/login') {
                setAuthStatus('unauthenticated');
                setCurrentRole(undefined); setCurrentCompanyId(undefined); // No setCurrentFirebaseUser(null)
                deleteCookie('userRole'); deleteCookie('companyId');
                router.push('/login');
            } else {
                setAuthStatus('unauthenticated'); // Allow login/register page to proceed
            }
          }
        } catch (error) {
          console.error("MainAppLayout verifyAndSetSession: Error fetching user data from Firestore:", error);
          setAuthStatus('unauthenticated');
          setCurrentRole(undefined); setCurrentCompanyId(undefined); // No setCurrentFirebaseUser(null)
          deleteCookie('userRole'); deleteCookie('companyId');
          if (pathname !== '/login' && pathname !== '/register-admin') router.push('/login');
        }
      }
    } else { 
      setAuthStatus('unauthenticated');
      setCurrentRole(undefined);
      setCurrentCompanyId(undefined);
      setCurrentFirebaseUser(null); // Explicitly nullify Firebase user on logout
      deleteCookie('userRole');
      deleteCookie('companyId');
      console.log("MainAppLayout verifyAndSetSession: No Firebase user. Session ended or user logged out.");
      if (pathname !== '/login' && pathname !== '/register-admin') {
          router.push('/login');
      }
    }
  }, [pathname, router]);


  useEffect(() => {
    console.log("MainAppLayout Mount: Subscribing to onAuthStateChanged.");
    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      console.log("MainAppLayout onAuthStateChanged: Firebase user:", user ? user.email : "null", "Current pathname:", pathname);
      verifyAndSetSession(user);
    });
    
    const handleSessionChanged = () => {
        console.log("MainAppLayout: 'userSessionChanged' event received. Re-verifying session.");
        // Use a slight delay to allow cookies to be fully processed by the browser if set by another component
        setTimeout(() => verifyAndSetSession(auth.currentUser), 50);
    };
    window.addEventListener('userSessionChanged', handleSessionChanged);

    return () => {
      console.log("MainAppLayout Unmount: Unsubscribing from onAuthStateChanged.");
      unsubscribe();
      window.removeEventListener('userSessionChanged', handleSessionChanged);
    };
  }, [verifyAndSetSession, pathname]); 

  if (authStatus === 'loading') {
    console.log("MainAppLayout: Auth status 'loading', showing skeleton.");
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
  
  if (authStatus === 'unauthenticated' && pathname !== '/login' && pathname !== '/register-admin') {
      console.log("MainAppLayout: Auth status 'unauthenticated', not on public page. Showing redirecting message. Path:", pathname);
      return (
         <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            <p className="text-lg text-muted-foreground">Redirecting to login...</p>
         </div>
      );
  }

  // For authenticated users on protected routes
  if (authStatus === 'authenticated' && currentRole && currentCompanyId && pathname !== '/login' && pathname !== '/register-admin') {
    console.log("MainAppLayout: User authenticated, rendering main app structure for role:", currentRole, "CompanyID:", currentCompanyId);
    return (
      <AppContextProvider value={{ userRole: currentRole, companyId: currentCompanyId, firebaseUser: currentFirebaseUser }}>
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
      </AppContextProvider>
    );
  }

  // For login or register-admin page (can be accessed when unauthenticated or during auth resolution)
  if (pathname === '/login' || pathname === '/register-admin') {
    console.log("MainAppLayout: Path is /login or /register-admin, rendering children. AuthStatus:", authStatus);
     return (
      <AppContextProvider value={{ userRole: currentRole, companyId: currentCompanyId, firebaseUser: currentFirebaseUser }}>
        {children}
      </AppContextProvider>
    );
  }
  
  // Fallback if none of the above conditions are met (should ideally not be common)
  // This could happen if authStatus is 'authenticated' but role/companyId are missing for a protected route.
  if (authStatus === 'authenticated' && (!currentRole || !currentCompanyId) && pathname !== '/login' && pathname !== '/register-admin') {
    console.warn("MainAppLayout: Authenticated but role/companyId missing for protected route. Redirecting to login. Role:", currentRole, "CompanyId:", currentCompanyId, "Path:", pathname);
    // Perform redirect if not already on login/register.
    // This state might indicate a problem with user data setup.
    // A direct router.push here might cause infinite loops if login page also fails to resolve session.
    // Deleting cookies and then pushing can be safer.
    deleteCookie('userRole');
    deleteCookie('companyId');
     return (
         <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            <p className="text-lg text-muted-foreground">Session error. Redirecting to login...</p>
         </div>
      );
  }


  console.log("MainAppLayout: Fallback rendering (final catch-all). AuthStatus:", authStatus, "pathname:", pathname, "role:", currentRole, "companyId:", currentCompanyId);
  return ( 
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Loading application interface...</p>
    </div>
  );
}

function AppContextProvider({ children, value }: { children: React.ReactNode, value: AppContextType }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
    