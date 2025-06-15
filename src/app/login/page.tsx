
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
 * Sets a 'userRole' cookie based on the email address for UI differentiation and basic route protection.
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
  // Ensure document is available (client-side)
  if (typeof document !== 'undefined') {
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  }
};

/**
 * Helper function to get a cookie value by name.
 * @param {string} name - The name of the cookie.
 * @returns {string | undefined} The cookie value or undefined if not found.
 */
const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
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

  /**
   * Effect hook to handle redirection if a user is already authenticated and lands on the login page.
   * It listens to Firebase's auth state. If a user is logged in (via Firebase) and
   * has a 'userRole' cookie, they are redirected to their respective dashboard.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Firebase indicates a user is signed in.
        // Check for the userRole cookie to decide on redirection.
        const userRoleCookie = getCookie('userRole');
        if (userRoleCookie === 'admin') {
          router.push('/'); // Redirect admin to admin dashboard
        } else if (userRoleCookie === 'store_manager') {
          router.push('/store-dashboard'); // Redirect manager to store dashboard
        }
        // If Firebase user exists but no valid role cookie, stay on login page.
        // The handleLogin function will establish the role and cookie upon a new login attempt.
        // Middleware handles unauthorized access to other protected pages.
      }
    });
    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [router]);


  /**
   * Handles the login process when the form is submitted.
   * - Authenticates with Firebase using email and password.
   * - Determines user role based on email content (admin@ or manager@).
   * - Sets a 'userRole' cookie for client-side role management.
   * - Redirects to the appropriate dashboard on successful login.
   * - Displays errors if login fails.
   */
  const handleLogin = async () => {
    setError(''); // Clear any previous errors
    setLoading(true); // Set loading state

    try {
      // Check if Firebase auth object is available (it should be if config is correct)
      if (!auth) {
        setError('Firebase authentication service is not available. Please check configuration.');
        setLoading(false);
        return;
      }

      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user && user.email) {
        let userRole = '';
        // Determine role based on email pattern
        if (user.email.toLowerCase().includes('admin@')) {
          userRole = 'admin';
        } else if (user.email.toLowerCase().includes('manager@')) {
          userRole = 'store_manager';
        } else {
          // If role cannot be determined, show error and sign out to prevent partial login state
          setError('User role could not be determined. Please contact support.');
          await signOut(auth); // Sign out the user from Firebase
          setLoading(false);
          return;
        }

        // Set the userRole cookie. Expires in 1 day.
        setCookie('userRole', userRole, 1);

        // Redirect based on role
        if (userRole === 'admin') {
          router.push('/'); // Admin dashboard
        } else if (userRole === 'store_manager') {
          router.push('/store-dashboard'); // Store Manager dashboard
        }
      } else {
        // This case should ideally not be reached if signInWithEmailAndPassword succeeds
        setError('An unexpected error occurred during login. User data not found.');
      }
    } catch (signInError: any) {
      // Handle Firebase authentication errors
      console.error("Firebase Sign-In Error:", signInError);
      if (signInError.code === 'auth/invalid-credential' || 
          signInError.code === 'auth/user-not-found' || 
          signInError.code === 'auth/wrong-password' ||
          signInError.code === 'auth/invalid-email') {
        setError('Invalid email or password. Please try again.');
      } else if (signInError.code === 'auth/invalid-api-key') {
        setError('Firebase API Key is invalid. Check your Firebase project configuration.');
      } else if (signInError.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection and try again.');
      } else if (signInError.code === 'auth/too-many-requests') {
        setError('Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.');
      }
       else {
        setError(signInError.message || 'Failed to login. An unknown error occurred.');
      }
    } finally {
      setLoading(false); // Reset loading state
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
              autoComplete="email" // Added for browser autofill
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
              autoComplete="current-password" // Added for browser autofill
            />
          </div>
          {/* Display login errors here */}
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
