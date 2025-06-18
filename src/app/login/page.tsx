
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building } from 'lucide-react';
import { auth, db } from '@/lib/firebase/firebaseConfig';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { UserProfile } from '@/app/(main)/my-profile/page'; // Import UserProfile for role type

/**
 * @fileOverview Login page for user authentication.
 * Handles user login using Firebase email/password authentication.
 * Fetches user role from Firestore after successful auth and sets a 'userRole' cookie.
 * Redirects users to appropriate dashboards upon successful login.
 * Also redirects already authenticated users away from the login page.
 */

const setCookie = (name: string, value: string, days: number) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  if (typeof document !== 'undefined') {
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
    console.log(`LoginPage: Cookie set: ${name}=${value}`);
    // Dispatch a custom event to notify other components (like SidebarNav) about role change
    window.dispatchEvent(new CustomEvent('userRoleChanged'));
  } else {
    console.warn("LoginPage: setCookie called when document is undefined.");
  }
};

const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') {
    console.warn("LoginPage: getCookie called when document is undefined.");
    return undefined;
  }
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

const deleteCookie = (name: string) => {
    if (typeof document !== 'undefined') {
        document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        console.log(`LoginPage: Cookie deleted: ${name}`);
        window.dispatchEvent(new CustomEvent('userRoleChanged')); // Notify of role removal
    } else {
        console.warn("LoginPage: deleteCookie called when document is undefined.");
    }
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    console.log("LoginPage Mount/Router Change: Subscribing to onAuthStateChanged for initial auth check.");
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("LoginPage Initial Auth Check: Firebase user state:", user ? user.email : "null");
      if (user) {
        let userRole = getCookie('userRole') as UserProfile['role'];
        
        // If no cookie, try to fetch role from Firestore (e.g., for session persistence)
        if (!userRole) {
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    userRole = userDocSnap.data()?.role as UserProfile['role'];
                    if (userRole) setCookie('userRole', userRole, 1); // Re-set cookie if found
                }
            } catch (e) {
                console.error("LoginPage Initial Auth Check: Error fetching user role from Firestore", e);
            }
        }
        
        console.log("LoginPage Initial Auth Check: User is authenticated. Role:", userRole);
        if (userRole === 'admin') {
          console.log("LoginPage Initial Auth Check: Admin identified. Redirecting to /");
          router.push('/');
        } else if (userRole === 'store_manager') {
          console.log("LoginPage Initial Auth Check: Manager identified. Redirecting to /store-dashboard");
          router.push('/store-dashboard');
        } else {
          console.log("LoginPage Initial Auth Check: Firebase user exists, but no valid role. Allowing login attempt.");
        }
      } else {
        console.log("LoginPage Initial Auth Check: No active Firebase user session.");
      }
      setAuthChecked(true);
    });
    return () => {
      console.log("LoginPage Unmount: Unsubscribing from onAuthStateChanged.");
      unsubscribe();
    };
  }, [router]);

  const handleLogin = async () => {
    console.log("LoginPage handleLogin: Attempting login for email:", email);
    setError('');
    setLoading(true);

    try {
      if (!auth) {
        console.error("LoginPage handleLogin: Firebase auth instance is not available.");
        setError('Authentication service is unavailable. Please try again later.');
        setLoading(false);
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("LoginPage handleLogin: Firebase signInWithEmailAndPassword successful for user:", user?.email);

      if (user && user.uid) {
        // Fetch role from Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        let userRole: UserProfile['role'] | undefined = undefined;

        if (userDocSnap.exists()) {
          userRole = userDocSnap.data()?.role as UserProfile['role'];
          console.log(`LoginPage handleLogin: Fetched role from Firestore: '${userRole}' for UID: ${user.uid}`);
        } else {
          console.warn(`LoginPage handleLogin: No user document found in Firestore for UID: ${user.uid}. Cannot determine role.`);
        }

        if (userRole) {
          setCookie('userRole', userRole, 1); 

          if (userRole === 'admin') {
            console.log("LoginPage handleLogin: Redirecting admin to /");
            router.push('/');
          } else if (userRole === 'store_manager') {
            console.log("LoginPage handleLogin: Redirecting store_manager to /store-dashboard");
            router.push('/store-dashboard');
          } else {
             // This case should ideally not be reached if role is one of the two expected
            console.error('LoginPage handleLogin: Unknown role fetched from Firestore:', userRole);
            setError('Your account has an unrecognized role. Please contact support.');
            await signOut(auth); 
            deleteCookie('userRole'); 
          }
        } else {
          console.error('LoginPage handleLogin: User role could not be determined from Firestore for UID:', user.uid);
          setError('Your account is not configured correctly (role missing in database). Please contact support.');
          await signOut(auth); 
          deleteCookie('userRole');
        }
      } else {
        console.error('LoginPage handleLogin: Firebase user object or UID is missing after successful sign-in.');
        setError('An unexpected error occurred after login. Please try again.');
        if (auth.currentUser) await signOut(auth);
        deleteCookie('userRole');
      }
    } catch (signInError: any) {
      console.error("LoginPage handleLogin: Firebase Sign-In Error. Code:", signInError.code, "Message:", signInError.message);
      if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password', 'auth/invalid-email'].includes(signInError.code) ) {
        setError('Invalid email or password. Please check your credentials and try again.');
      } else if (signInError.code === 'auth/network-request-failed') {
        setError('A network error occurred. Please check your internet connection.');
      } else if (signInError.code === 'auth/too-many-requests') {
        setError('Access to this account has been temporarily disabled due to many failed login attempts. You can try again later or reset your password.');
      } else {
        setError(signInError.message || 'Failed to login due to an unknown error.');
      }
    } finally {
      setLoading(false);
      console.log("LoginPage handleLogin: Login attempt finished.");
    }
  };
  
  if (!authChecked) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <p className="text-muted-foreground">Checking authentication status...</p>
        </div>
      );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl rounded-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center items-center mb-4">
            <Building className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold font-headline text-foreground">KBMS Billing</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="e.g., admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} autoComplete="email"/>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} autoComplete="current-password"/>
          </div>
          {error && <p className="text-sm text-destructive text-center pt-2">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleLogin} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
