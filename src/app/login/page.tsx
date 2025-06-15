
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building } from 'lucide-react';
import { auth } from '@/lib/firebase/firebaseConfig';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

/**
 * @fileOverview Login page for user authentication.
 * Handles user login using Firebase email/password authentication.
 * Sets a 'userRole' cookie based on the email address for UI differentiation.
 * Redirects users to appropriate dashboards upon successful login.
 */

/**
 * Sets a cookie in the browser.
 * @param name - The name of the cookie.
 * @param value - The value of the cookie.
 * @param days - The number of days until the cookie expires.
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

  // Redirect if already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, check role and redirect
        const userRoleCookie = document.cookie.split('; ').find(row => row.startsWith('userRole='))?.split('=')[1];
        if (userRoleCookie === 'admin') {
          router.push('/');
        } else if (userRoleCookie === 'store_manager') {
          router.push('/store-dashboard');
        } else {
          // If role cookie is missing but user is auth'd, attempt to set it.
          // This path might be hit if a user bookmarked /login but was already authenticated.
           let determinedRole = '';
            if (user.email?.toLowerCase().includes('admin@')) {
              determinedRole = 'admin';
            } else if (user.email?.toLowerCase().includes('manager@')) {
              determinedRole = 'store_manager';
            }
            if(determinedRole) {
                setCookie('userRole', determinedRole, 1);
                router.push(determinedRole === 'admin' ? '/' : '/store-dashboard');
            } else {
                 // Failsafe, redirect to login if role unknown
                router.push('/login');
            }
        }
      }
    });
    return () => unsubscribe();
  }, [router]);


  /**
   * Handles the login process when the form is submitted.
   * Authenticates with Firebase, sets user role cookie, and redirects.
   */
  const handleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      if (!auth.app) {
        setError('Firebase app is not initialized. Check configuration.');
        setLoading(false);
        return;
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user && user.email) {
        let userRole = '';
        if (user.email.toLowerCase().includes('admin@')) {
          userRole = 'admin';
        } else if (user.email.toLowerCase().includes('manager@')) {
          userRole = 'store_manager';
        } else {
          setError('User role could not be determined. Please contact support.');
          await signOut(auth);
          setLoading(false);
          return;
        }

        setCookie('userRole', userRole, 1); // Store role in a cookie for UI & middleware

        if (userRole === 'admin') {
          router.push('/');
        } else if (userRole === 'store_manager') {
          router.push('/store-dashboard');
        }
      } else {
        setError('An unexpected error occurred during login.');
      }
    } catch (signInError: any) {
      console.error("Firebase Sign-In Error:", signInError);
      if (signInError.code === 'auth/invalid-credential' || signInError.code === 'auth/user-not-found' || signInError.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (signInError.code === 'auth/invalid-api-key') {
        setError('Firebase API Key is invalid. Check your Firebase project configuration in firebaseConfig.ts.');
      } else if (signInError.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(signInError.message || 'Failed to login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center items-center mb-4">
            <Building className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold font-headline text-foreground">KBMS Billing</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          {error && <p className="text-sm text-destructive">{error}</p>}
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
