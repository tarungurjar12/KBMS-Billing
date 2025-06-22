
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// Link import is removed as we are testing router.push directly for this item
// import Link from 'next/link'; 
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building, Cog, UserPlus, Bug } from 'lucide-react';
import { auth, db } from '@/lib/firebase/firebaseConfig';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { UserProfile } from '@/app/(main)/my-profile/page';
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
    window.dispatchEvent(new CustomEvent('userSessionChanged'));
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
        window.dispatchEvent(new CustomEvent('userSessionChanged'));
    } else {
        console.warn("LoginPage: deleteCookie called when document is undefined.");
    }
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const registrationSuccess = searchParams.get('registrationSuccess');
    if (registrationSuccess === 'true') {
        toast({
            title: "Registration Successful!",
            description: "You can now log in with your new admin account.",
            variant: "default", 
            duration: 5000,
        });
        // Use router.replace to remove the query parameter from the URL without adding to history
        router.replace('/login', { scroll: false });
    }
  }, [searchParams, toast, router]);

  useEffect(() => {
    console.log("LoginPage Mount/Router Change: Subscribing to onAuthStateChanged for initial auth check.");
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("LoginPage Initial Auth Check: Firebase user state:", user ? user.email : "null");
      if (user) {
        let userRole = getCookie('userRole') as UserProfile['role'];
        let companyId = getCookie('companyId');
        
        if (!userRole || !companyId) { 
            try {
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    userRole = userData?.role as UserProfile['role'];
                    companyId = userData?.companyId as string;
                    if (userRole) setCookie('userRole', userRole, 1); 
                    if (companyId) setCookie('companyId', companyId, 1);
                }
            } catch (e: any) {
                console.error("LoginPage Initial Auth Check: Error fetching user data from Firestore", e);
            }
        }
        
        console.log("LoginPage Initial Auth Check: User is authenticated. Role:", userRole, "CompanyID:", companyId);
        if (userRole && companyId) { 
            if (userRole === 'admin') {
                console.log("LoginPage Initial Auth Check: Admin identified. Redirecting to /");
                router.push('/');
            } else if (userRole === 'store_manager') {
                console.log("LoginPage Initial Auth Check: Manager identified. Redirecting to /store-dashboard");
                router.push('/store-dashboard');
            } else {
                 console.log("LoginPage Initial Auth Check: Firebase user exists, but no valid role/companyId combination. Allowing login attempt or staying on page.");
            }
        } else {
             console.log("LoginPage Initial Auth Check: User authenticated with Firebase but role/companyId missing from cookies/DB. Staying on login page to re-establish.");
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
        // --- Single Session Logic ---
        const newSessionId = Date.now().toString();
        const userDocRef = doc(db, "users", user.uid);
        // Use setDoc with merge to create/update the field without overwriting the whole doc
        await setDoc(userDocRef, { activeSessionId: newSessionId }, { merge: true });
        setCookie('activeSessionId', newSessionId, 1);
        console.log(`LoginPage handleLogin: Set new session ID ${newSessionId} for UID ${user.uid}`);
        // --- End Single Session Logic ---

        let userDocSnap;
        let firestoreError: any = null;

        try {
          console.log(`LoginPage handleLogin: Attempting to fetch Firestore document: users/${user.uid}`);
          userDocSnap = await getDoc(userDocRef);
        } catch (e: any) {
          console.error(`LoginPage handleLogin: Error fetching user document from Firestore for UID: ${user.uid}. Code: ${e.code}, Message: ${e.message}`, e);
          firestoreError = e;
        }

        let userRole: UserProfile['role'] | undefined = undefined;
        let companyId: string | undefined = undefined;

        if (userDocSnap?.exists()) { 
          const userData = userDocSnap.data();
          userRole = userData?.role as UserProfile['role'];
          companyId = userData?.companyId as string; 
          console.log(`LoginPage handleLogin: Fetched role: '${userRole}', companyId: '${companyId}' from Firestore for UID: ${user.uid}`);
        } else if (!firestoreError) { 
          console.warn(`LoginPage handleLogin: No user document found in Firestore for UID: ${user.uid}.`);
        }
        
        if (userRole && companyId) { 
          setCookie('userRole', userRole, 1); 
          setCookie('companyId', companyId, 1); 

          if (userRole === 'admin') {
            console.log("LoginPage handleLogin: Redirecting admin to /");
            router.push('/');
          } else if (userRole === 'store_manager') {
            console.log("LoginPage handleLogin: Redirecting store_manager to /store-dashboard");
            router.push('/store-dashboard');
          } else {
            console.error('LoginPage handleLogin: Unknown role fetched from Firestore:', userRole);
            setError('Your account has an unrecognized role. Please contact support.');
            await signOut(auth); 
            deleteCookie('userRole'); 
            deleteCookie('companyId');
            deleteCookie('activeSessionId');
          }
        } else {
          const errorDetail = firestoreError 
            ? `(Firestore Error: ${firestoreError.code || 'UnknownCode'} - ${firestoreError.message || 'Unknown Firestore Error'})` 
            : `(Document not found or role/companyId field missing in Firestore for UID: ${user.uid})`;
          console.error('LoginPage handleLogin: User role or companyId could not be determined from Firestore.', errorDetail);
          setError(`Your account is not configured correctly. ${errorDetail}. Please contact support.`);
          await signOut(auth); 
          deleteCookie('userRole');
          deleteCookie('companyId');
          deleteCookie('activeSessionId');
        }
      } else {
        console.error('LoginPage handleLogin: Firebase user object or UID is missing after successful sign-in.');
        setError('An unexpected error occurred after login. Please try again.');
        if (auth.currentUser) await signOut(auth);
        deleteCookie('userRole');
        deleteCookie('companyId');
        deleteCookie('activeSessionId');
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Settings">
              <Cog className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem 
              onClick={() => {
                console.log("LoginPage: 'Create Admin Account' clicked. Attempting to navigate to /register-admin");
                router.push('/register-admin');
              }} 
              className="flex items-center w-full cursor-pointer"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              <span>Create Admin Account</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast({ title: "Report Issue", description: "Report Issue functionality is planned for a future update.", duration: 3000 })}>
              <Bug className="mr-2 h-4 w-4" />
              <span>Report Issue</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
        <CardFooter className="flex flex-col gap-4">
          <Button className="w-full" onClick={handleLogin} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
