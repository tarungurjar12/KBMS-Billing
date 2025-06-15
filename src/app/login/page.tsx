
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building } from 'lucide-react';
import { auth } from '@/lib/firebase/firebaseConfig';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';

/**
 * @fileOverview Login page for user authentication.
 * Handles user login using Firebase email/password authentication.
 * Sets a 'userRole' cookie based on the email address for UI differentiation.
 * Redirects users to appropriate dashboards upon successful login.
 * Also redirects already authenticated users away from the login page.
 */

/**
 * Sets a cookie in the browser.
 * @param {string} name - The name of the cookie.
 * @param {string} value - The value of the cookie.
 * @param {number} days - The number of days until the cookie expires.
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
  } else {
    console.warn("LoginPage: setCookie called when document is undefined (not in browser context).");
  }
};

/**
 * Retrieves a cookie value by name.
 * @param {string} name - The name of the cookie.
 * @returns {string | undefined} The cookie value or undefined if not found.
 */
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

/**
 * Deletes a cookie by name.
 * @param {string} name - The name of the cookie.
 */
const deleteCookie = (name: string) => {
    if (typeof document !== 'undefined') {
        document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        console.log(`LoginPage: Cookie deleted: ${name}`);
    } else {
        console.warn("LoginPage: deleteCookie called when document is undefined.");
    }
};

/**
 * LoginPage component.
 * Provides a form for users to enter email and password to log in.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // authChecked determines if the initial check for an existing Firebase session is complete.
  // The login form is only rendered after this check to prevent UI flicker or premature redirects.
  const [authChecked, setAuthChecked] = useState(false);

  /**
   * Effect hook to check for an existing Firebase authentication session when the component mounts.
   * If a user is already authenticated (and their role cookie is present),
   * it redirects them to their appropriate dashboard.
   * This prevents authenticated users from seeing the login page unnecessarily.
   */
  useEffect(() => {
    console.log("LoginPage Mount/Router Change: Subscribing to onAuthStateChanged for initial auth check.");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("LoginPage Initial Auth Check: Firebase user state:", user ? user.email : "null");
      if (user) {
        const userRoleCookie = getCookie('userRole');
        console.log("LoginPage Initial Auth Check: User is authenticated. Role cookie:", userRoleCookie);
        if (userRoleCookie === 'admin') {
          console.log("LoginPage Initial Auth Check: Admin already logged in. Redirecting to /");
          router.push('/');
        } else if (userRoleCookie === 'store_manager') {
          console.log("LoginPage Initial Auth Check: Manager already logged in. Redirecting to /store-dashboard");
          router.push('/store-dashboard');
        } else {
          // User is authenticated by Firebase, but role cookie is missing or invalid.
          // This can happen if the cookie expired. Let them stay on login to re-authenticate.
          console.log("LoginPage Initial Auth Check: Firebase user exists, but no valid role cookie. Allowing login attempt.");
        }
      } else {
        console.log("LoginPage Initial Auth Check: No active Firebase user session.");
      }
      setAuthChecked(true); // Mark initial auth check as complete
    });

    // Cleanup subscription on component unmount
    return () => {
      console.log("LoginPage Unmount: Unsubscribing from onAuthStateChanged.");
      unsubscribe();
    };
  }, [router]); // Effect runs once on mount due to router being stable.

  /**
   * Handles the login process when the form is submitted.
   * Attempts to sign in with Firebase, determines user role, sets a role cookie,
   * and then redirects to the appropriate dashboard.
   */
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

      if (user && user.email) {
        let userRole = '';
        const lowerCaseEmail = user.email.toLowerCase();

        // Determine user role based on email pattern
        if (lowerCaseEmail.includes('admin@')) {
          userRole = 'admin';
        } else if (lowerCaseEmail.includes('manager@')) {
          userRole = 'store_manager';
        }
        console.log(`LoginPage handleLogin: Determined role: '${userRole}' for email: ${user.email}`);

        if (userRole) {
          setCookie('userRole', userRole, 1); // Set role cookie, expires in 1 day

          // Redirect to the appropriate dashboard based on role
          if (userRole === 'admin') {
            console.log("LoginPage handleLogin: Redirecting admin to /");
            router.push('/');
          } else if (userRole === 'store_manager') {
            console.log("LoginPage handleLogin: Redirecting store_manager to /store-dashboard");
            router.push('/store-dashboard');
          }
        } else {
          // Role could not be determined from email, which is unexpected for valid users.
          console.error('LoginPage handleLogin: User role could not be determined from email:', user.email);
          setError('Your account is not configured correctly. Please contact support.');
          await signOut(auth); // Sign out the user as their role is unclear
          deleteCookie('userRole'); // Ensure no invalid role cookie persists
        }
      } else {
        // This case should ideally not be reached if signInWithEmailAndPassword was successful
        console.error('LoginPage handleLogin: Firebase user object or email is missing after successful sign-in.');
        setError('An unexpected error occurred after login. Please try again.');
        if (auth.currentUser) await signOut(auth); // Sign out if partially logged in
        deleteCookie('userRole');
      }
    } catch (signInError: any) {
      // Handle various Firebase authentication errors
      console.error("LoginPage handleLogin: Firebase Sign-In Error. Code:", signInError.code, "Message:", signInError.message);
      if (signInError.code === 'auth/invalid-credential' || 
          signInError.code === 'auth/user-not-found' || 
          signInError.code === 'auth/wrong-password' ||
          signInError.code === 'auth/invalid-email') {
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
  
  // Display a loading indicator or nothing until the initial auth check is complete.
  // This prevents the login form from flashing if the user is already authenticated and being redirected.
  if (!authChecked) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
            <p className="text-muted-foreground">Checking authentication status...</p>
        </div>
      );
  }

  // Render the login form once the initial auth check is done and no auto-redirect occurred.
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
            <Input 
              id="email" 
              type="email"
              placeholder="e.g., admin@example.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              disabled={loading}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              placeholder="Enter your password"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              disabled={loading}
              autoComplete="current-password"
            />
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

    