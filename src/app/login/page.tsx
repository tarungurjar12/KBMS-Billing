
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building } from 'lucide-react';
import { auth } from '@/lib/firebase/firebaseConfig'; // Import Firebase auth
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

// Basic cookie utility
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (user) {
        // Determine role based on email (temporary simple logic)
        let userRole = '';
        if (user.email?.toLowerCase().includes('admin@')) {
          userRole = 'admin';
        } else if (user.email?.toLowerCase().includes('manager@')) {
          userRole = 'store_manager';
        } else {
          setError('User role could not be determined. Please contact support.');
          await signOut(auth); // Sign out if role is undetermined
          setLoading(false);
          return;
        }

        setCookie('userRole', userRole, 1); // Store role in a cookie for UI

        if (userRole === 'admin') {
          router.push('/');
        } else if (userRole === 'store_manager') {
          router.push('/store-dashboard');
        }
        // router.refresh(); // May not be needed if middleware handles redirection correctly based on cookie
      } else {
        setError('An unexpected error occurred during login.');
      }
    } catch (signInError: any) {
      if (signInError.code === 'auth/invalid-credential' || signInError.code === 'auth/user-not-found' || signInError.code === 'auth/wrong-password') {
        setError('Invalid email or password.');
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
