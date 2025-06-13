
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building } from 'lucide-react';

// Basic cookie utility
const setCookie = (name: string, value: string, days: number) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
};

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    setError(''); // Clear previous errors

    if (userId === 'admin' && password === 'admin') {
      setCookie('userRole', 'admin', 1);
      setCookie('authStatus', 'loggedIn', 1);
      router.push('/'); // Redirect to Admin Dashboard
    } else if (userId === 'manager' && password === 'manager') {
      setCookie('userRole', 'store_manager', 1);
      setCookie('authStatus', 'loggedIn', 1);
      // For now, redirecting to a placeholder store manager dashboard
      router.push('/store-dashboard'); 
    } else {
      setError('Invalid User ID or Password.');
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
            <Label htmlFor="userId">User ID</Label>
            <Input 
              id="userId" 
              placeholder="e.g., admin or manager" 
              value={userId} 
              onChange={(e) => setUserId(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              placeholder="e.g., admin or manager"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleLogin}>
            Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
