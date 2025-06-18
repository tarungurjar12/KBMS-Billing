
"use client"; 

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { UserCircle, ShieldCheck, Mail, Phone } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from '@/lib/firebase/firebaseConfig'; 
import { onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"; 

/**
 * @fileOverview My Profile page for authenticated users (Admin and Store Manager).
 * Allows users to:
 *  - View their profile information (name, email, contact number from Firestore).
 *  - Update their name and contact number (saved to Firestore).
 *  - Change their password (via Firebase Auth).
 */

interface UserProfile {
  uid: string; 
  name: string; 
  email: string; 
  contactNumber: string; 
  role?: 'admin' | 'store_manager'; 
}

export default function MyProfilePage() {
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState(""); 
  const [contactNumber, setContactNumber] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid); 
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const profile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "N/A",
              name: userData.name || firebaseUser.displayName || "User", 
              contactNumber: userData.contactNumber || "",
              role: userData.role, 
            };
            setUserProfile(profile);
            setName(profile.name); 
            setContactNumber(profile.contactNumber); 
          } else {
            // Document doesn't exist, initialize local state for potential creation on save
            const profile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "N/A",
              name: firebaseUser.displayName || firebaseUser.email || "User", 
              contactNumber: "",
              role: undefined, // Role might be determinable later or set on first save
            };
            setUserProfile(profile);
            setName(profile.name);
            setContactNumber(profile.contactNumber); // Ensure contact number from this default is set
            toast({ title: "Profile Incomplete", description: "Your profile details are not fully set up in the database. Please update and save.", variant: "default"});
          }
        } catch (error) {
            console.error("Error fetching user profile from Firestore:", error);
            toast({ title: "Profile Load Error", description: "Could not load your full profile details.", variant: "destructive"});
            // Fallback local profile if Firestore read fails
            const profile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "N/A",
              name: firebaseUser.displayName || firebaseUser.email || "User",
              contactNumber: "",
              role: undefined,
            };
            setUserProfile(profile);
            setName(profile.name);
            setContactNumber(profile.contactNumber);
        }
      } else {
        setUserProfile(null); 
      }
      setIsLoading(false);
    });
    return () => unsubscribe(); 
  }, [toast]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    let profileUpdatedInFirestore = false;
    let passwordChanged = false;

    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !userProfile) { 
      toast({ title: "Authentication Error", description: "User not authenticated or profile data missing.", variant: "destructive" });
      setIsUpdating(false);
      return;
    }

    // Check if name or contactNumber actually changed, or if profile was just loaded and is being saved for the first time
    const hasProfileInfoChanges = name !== userProfile.name || contactNumber !== userProfile.contactNumber;
    // We might want to save even if no changes if the profile was just loaded and potentially incomplete
    // For now, we'll save if there are changes or if the user document might be new (though userProfile.uid should always exist if authenticated)

    if (hasProfileInfoChanges) {
      try {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const profileDataToSave: any = {
          name: name,
          email: userProfile.email, // Keep email from auth/initial load
          contactNumber: contactNumber,
          updatedAt: serverTimestamp(),
        };
        if (userProfile.role) { // Persist role if it was loaded
          profileDataToSave.role = userProfile.role;
        }
        
        // Use setDoc with merge:true to create if not exists, or update if exists
        await setDoc(userDocRef, profileDataToSave, { merge: true });
        
        setUserProfile(prev => prev ? {
            ...prev, 
            name: name, 
            contactNumber: contactNumber 
        } : null); 
        profileUpdatedInFirestore = true;
      } catch (error) {
        console.error("Error updating profile in Firestore: ", error);
        toast({ title: "Profile Update Failed", description: "Failed to update your name or contact number in the database.", variant: "destructive" });
      }
    }

    if (newPassword) {
      if (newPassword !== confirmNewPassword) {
        toast({ title: "Password Mismatch", description: "New passwords do not match. Please re-enter.", variant: "destructive" });
        setIsUpdating(false);
        return;
      }
      if (!currentPassword) {
        toast({ title: "Current Password Required", description: "Please enter your current password to set a new one.", variant: "destructive" });
        setIsUpdating(false);
        return;
      }

      try {
        if (firebaseUser.email) { 
            const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
            await reauthenticateWithCredential(firebaseUser, credential);
            await updatePassword(firebaseUser, newPassword); 
            passwordChanged = true;
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
        } else {
            throw new Error("User email not found for re-authentication. Cannot change password.");
        }
      } catch (error: any) {
        console.error("Error updating password: ", error);
        let errorMessage = "Failed to update password. Please try again.";
        if (error.code === 'auth/wrong-password') {
            errorMessage = "Incorrect current password. Please try again.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "The new password is too weak. It must be at least 6 characters.";
        } else if (error.code === 'auth/requires-recent-login') {
             errorMessage = "This operation is sensitive and requires recent authentication. Please log out and log back in before changing your password.";
        }
        toast({ title: "Password Change Failed", description: errorMessage, variant: "destructive" });
        setIsUpdating(false);
        return; 
      }
    }

    if (profileUpdatedInFirestore && passwordChanged) {
      toast({ title: "Profile & Password Updated", description: "Your information and password have been successfully updated." });
    } else if (profileUpdatedInFirestore) {
      toast({ title: "Profile Updated", description: "Your name/contact information has been updated." });
    } else if (passwordChanged) {
      toast({ title: "Password Changed", description: "Your password has been successfully updated." });
    } else if (!hasProfileInfoChanges && !newPassword) { 
       toast({ title: "No Changes Detected", description: "No information was changed." });
    }
    
    setIsUpdating(false);
  };
  
  if (isLoading) {
    return <PageHeader title="My Profile" description="Loading your profile information..." icon={UserCircle} />;
  }

  if (!userProfile) {
    return <PageHeader title="My Profile" description="Please log in to view your profile." icon={UserCircle} />;
  }

  return (
    <>
      <PageHeader
        title="My Profile"
        description="View and update your personal information and account password."
        icon={UserCircle}
      />
      <Card className="shadow-lg rounded-xl max-w-2xl mx-auto">
        <form onSubmit={handleUpdateProfile}>
          <CardHeader>
            <CardTitle className="font-headline text-foreground">Your Account Details</CardTitle>
            <CardDescription>Manage your display name, contact information, and password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground"/>Email (Login ID)</Label>
              <Input id="email" value={userProfile.email} disabled readOnly className="bg-muted/50"/>
               {userProfile.role && <p className="text-xs text-muted-foreground mt-1">Role: <span className="font-semibold capitalize">{userProfile.role.replace('_', ' ')}</span></p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center"><UserCircle className="mr-2 h-4 w-4 text-muted-foreground"/>Display Name</Label>
              <Input 
                id="name" 
                placeholder="Enter your display name" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isUpdating}
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactNumber" className="flex items-center"><Phone className="mr-2 h-4 w-4 text-muted-foreground"/>Contact Number</Label>
              <Input 
                id="contactNumber" 
                placeholder="Enter your contact number" 
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                disabled={isUpdating}
                autoComplete="tel"
              />
            </div>
            
            <div className="border-t pt-6 space-y-2">
                <h3 className="text-lg font-medium flex items-center"><ShieldCheck className="mr-2 h-5 w-5 text-primary" />Change Password</h3>
                <p className="text-sm text-muted-foreground">Leave these fields blank if you do not want to change your password.</p>
            </div>
             <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input 
                id="currentPassword" 
                type="password" 
                placeholder="Enter current password to change" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isUpdating}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input 
                id="newPassword" 
                type="password" 
                placeholder="Enter new password (min. 6 characters)" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isUpdating}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <Input 
                id="confirmNewPassword" 
                type="password" 
                placeholder="Re-enter new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)} 
                disabled={isUpdating}
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row">
            <Button type="submit" className="w-full sm:w-auto" disabled={isUpdating || isLoading}>
              {isUpdating ? "Updating Profile..." : "Update Profile & Password"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}

    