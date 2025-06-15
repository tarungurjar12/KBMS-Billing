
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building } from 'lucide-react'; // Icon for branding
import { auth } from '@/lib/firebase/firebaseConfig'; // Firebase auth instance
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth'; // Firebase auth functions

/**
 * @fileOverview Login page for user authentication.
 * Handles user login using Firebase email/password authentication.
 * Sets a 'userRole' cookie based on the email address for UI differentiation.
 * Redirects users to appropriate dashboards upon successful login.
 * Also redirects already authenticated users away from the login page.
 */

/**
 * Helper function to set a cookie in the browser.
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
    console.log(`Cookie set: ${name}=${value}`);
  } else {
    console.warn("setCookie: document is undefined (not in browser context).");
  }
};

/**
 * Helper function to get a cookie value by name.
 * @param {string} name - The name of the cookie.
 * @returns {string | undefined} The cookie value or undefined if not found.
 */
const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') {
    console.warn("getCookie: document is undefined (not in browser context).");
    return undefined;
  }
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

/**
 * Helper function to delete a cookie by name.
 * @param {string} name - The name of the cookie.
 */
const deleteCookie = (name: string) => {
    if (typeof document !== 'undefined') {
        document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        console.log(`Cookie deleted: ${name}`);
    } else {
        console.warn("deleteCookie: document is undefined (not in browser context).");
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
  const [error, setError] = useState(''); // State for displaying login errors
  const [loading, setLoading] = useState(false); // State to manage loading UI during login attempt

  // Effect to handle redirection if a user is already authenticated when they visit the login page
  useEffect(() => {
    console.log("LoginPage useEffect: Subscribing to onAuthStateChanged.");
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("LoginPage onAuthStateChanged: Firebase user:", user);
      if (user) {
        const userRoleCookie = getCookie('userRole');
        console.log("LoginPage onAuthStateChanged: userRoleCookie:", userRoleCookie);
        if (userRoleCookie === 'admin') {
          console.log("LoginPage onAuthStateChanged: Admin already logged in, redirecting to /");
          router.push('/');
        } else if (userRoleCookie === 'store_manager') {
          console.log("LoginPage onAuthStateChanged: Manager already logged in, redirecting to /store-dashboard");
          router.push('/store-dashboard');
        }
      } else {
        console.log("LoginPage onAuthStateChanged: No Firebase user session.");
      }
    });
    return () => {
      console.log("LoginPage useEffect: Unsubscribing from onAuthStateChanged.");
      unsubscribe();
    };
  }, [router]); // Rerun if router object changes.

  /**
   * Handles the login process when the form is submitted.
   */
  const handleLogin = async () => {
    console.log("handleLogin: Attempting login with email:", email);
    setError('');
    setLoading(true);

    try {
      if (!auth) {
        console.error("handleLogin: Firebase auth service is not available.");
        setError('Firebase authentication service is not available. Please check configuration.');
        setLoading(false);
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("handleLogin: Firebase signInWithEmailAndPassword successful. User:", user);

      if (user && user.email) {
        let userRole = '';
        const lowerCaseEmail = user.email.toLowerCase();

        if (lowerCaseEmail.includes('admin@')) {
          userRole = 'admin';
        } else if (lowerCaseEmail.includes('manager@')) {
          userRole = 'store_manager';
        }
        console.log(`handleLogin: Determined role: '${userRole}' for email: ${user.email}`);

        if (userRole) {
          setCookie('userRole', userRole, 1); // Set cookie for 1 day
          console.log(`handleLogin: Role determined: ${userRole}. Cookie 'userRole' set.`);

          if (userRole === 'admin') {
            console.log("handleLogin: Redirecting admin to /");
            router.push('/');
          } else if (userRole === 'store_manager') {
            console.log("handleLogin: Redirecting manager to /store-dashboard");
            router.push('/store-dashboard');
          }
        } else {
          console.error('handleLogin: User role could not be determined from email:', user.email);
          setError('User role could not be determined. Please contact support.');
          await signOut(auth);
          deleteCookie('userRole');
        }
      } else {
        console.error('handleLogin: Firebase user object or email is missing after sign-in.');
        setError('An unexpected error occurred during login. User data not found.');
        if (auth.currentUser) await signOut(auth); // Sign out if partially logged in
        deleteCookie('userRole');
      }
    } catch (signInError: any) {
      console.error("handleLogin: Firebase Sign-In Error:", signInError.code, signInError.message);
      if (signInError.code === 'auth/invalid-credential' || 
          signInError.code === 'auth/user-not-found' || 
          signInError.code === 'auth/wrong-password' ||
          signInError.code === 'auth/invalid-email') {
        setError('Invalid email or password. Please try again.');
      } else if (signInError.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else if (signInError.code === 'auth/too-many-requests') {
        setError('Access to this account has been temporarily disabled due to many failed login attempts. Try again later.');
      } else {
        setError(signInError.message || 'Failed to login. An unknown error occurred.');
      }
    } finally {
      console.log("handleLogin: Setting loading to false.");
      setLoading(false);
    }
  };

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
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
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
