
"use client"; // For form handling and potential updates

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { UserCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { auth } from '@/lib/firebase/firebaseConfig';
import { onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
// Future: Import Firestore functions if profile data (like contact number) is stored there.
// import { doc, getDoc, updateDoc } from "firebase/firestore";
// import { db } from "@/lib/firebase/firebaseConfig";

/**
 * @fileOverview My Profile page for authenticated users (Admin and Store Manager).
 * Allows users to:
 *  - View their basic profile information (name, user ID/email).
 *  - Update their contact number (placeholder for now).
 *  - Change their password.
 */

interface UserProfile {
  name: string; // Could be from a 'users' or 'managers' collection in Firestore
  email: string; // From Firebase Auth
  contactNumber: string;
  // Future: role, lastLogin, etc.
}

/**
 * MyProfilePage component.
 * Provides UI for users to view and manage their profile details.
 */
export default function MyProfilePage() {
  const { toast } = useToast();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form states for profile update
  const [contactNumber, setContactNumber] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Effect to fetch current user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Phase 1: Use email as name/ID for now. Contact number is local state.
        // Future: Fetch additional profile details (name, contactNumber) from Firestore 'users' or 'managers' collection
        // const userDocRef = doc(db, "users", firebaseUser.uid); // Or 'managers' collection
        // const userDoc = await getDoc(userDocRef);
        // if (userDoc.exists()) {
        //   const userData = userDoc.data();
        //   setUser({
        //     email: firebaseUser.email || "N/A",
        //     name: userData.name || firebaseUser.displayName || "User",
        //     contactNumber: userData.contactNumber || "",
        //   });
        //   setContactNumber(userData.contactNumber || "");
        // } else {
          setUser({
            email: firebaseUser.email || "N/A",
            name: firebaseUser.displayName || firebaseUser.email || "User", // Fallback name
            contactNumber: "", // Default if not in Firestore
          });
        // }
      } else {
        setUser(null); // Should be redirected by middleware if not authenticated
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  /**
   * Handles profile update (contact number and password).
   */
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    let profileUpdated = false;
    let passwordChanged = false;

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      toast({ title: "Error", description: "User not authenticated.", variant: "destructive" });
      setIsUpdating(false);
      return;
    }

    // Future: Update contact number in Firestore
    // if (contactNumber && contactNumber !== user?.contactNumber) {
    //   try {
    //     const userDocRef = doc(db, "users", firebaseUser.uid); // Or relevant collection
    //     await updateDoc(userDocRef, { contactNumber: contactNumber });
    //     setUser(prev => prev ? {...prev, contactNumber: contactNumber} : null);
    //     profileUpdated = true;
    //   } catch (error) {
    //     console.error("Error updating contact number: ", error);
    //     toast({ title: "Error", description: "Failed to update contact number.", variant: "destructive" });
    //   }
    // }
    // Phase 1: Simulate contact number update
    if (contactNumber !== user?.contactNumber) {
        setUser(prev => prev ? {...prev, contactNumber: contactNumber} : null);
        profileUpdated = true;
        toast({ title: "Contact Number Updated (Locally)", description: "Your contact number has been updated." });
    }


    // Handle password change
    if (newPassword) {
      if (newPassword !== confirmNewPassword) {
        toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
        setIsUpdating(false);
        return;
      }
      if (!currentPassword) {
        toast({ title: "Error", description: "Current password is required to change password.", variant: "destructive" });
        setIsUpdating(false);
        return;
      }

      try {
        // Re-authenticate user before password update for security
        if (firebaseUser.email) {
            const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
            await reauthenticateWithCredential(firebaseUser, credential);
            await updatePassword(firebaseUser, newPassword);
            passwordChanged = true;
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
        } else {
            throw new Error("User email not found for re-authentication.");
        }
      } catch (error: any) {
        console.error("Error updating password: ", error);
        let errorMessage = "Failed to update password.";
        if (error.code === 'auth/wrong-password') {
            errorMessage = "Incorrect current password.";
        } else if (error.code === 'auth/weak-password') {
            errorMessage = "New password is too weak.";
        }
        toast({ title: "Password Update Failed", description: errorMessage, variant: "destructive" });
        setIsUpdating(false);
        return; // Stop further processing if password change failed
      }
    }

    if (profileUpdated && !passwordChanged) {
      // toast({ title: "Profile Updated", description: "Your contact information has been updated." });
    } else if (passwordChanged && !profileUpdated) {
      toast({ title: "Password Changed", description: "Your password has been successfully updated." });
    } else if (profileUpdated && passwordChanged) {
      toast({ title: "Profile & Password Updated", description: "Your information and password have been updated." });
    } else if (!profileUpdated && !passwordChanged && newPassword) {
      // This case should be caught by earlier checks, but as a fallback
    } else if (!profileUpdated && !newPassword) {
       toast({ title: "No Changes", description: "No information was changed." });
    }
    
    setIsUpdating(false);
  };
  
  if (isLoading) {
    return <PageHeader title="My Profile" description="Loading your profile..." icon={UserCircle} />;
  }

  if (!user) {
    // This should ideally be handled by middleware redirecting to login
    return <PageHeader title="My Profile" description="Please log in to view your profile." icon={UserCircle} />;
  }

  return (
    <>
      <PageHeader
        title="My Profile"
        description="View and update your personal information and password."
        icon={UserCircle}
      />
      <Card className="shadow-lg rounded-xl max-w-2xl mx-auto">
        <form onSubmit={handleUpdateProfile}>
          <CardHeader>
            <CardTitle className="font-headline text-foreground">Your Details</CardTitle>
            <CardDescription>Update your contact information and manage your password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={user.name} disabled readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (User ID)</Label>
              <Input id="email" value={user.email} disabled readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input 
                id="contactNumber" 
                placeholder="Enter your contact number" 
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                disabled={isUpdating}
              />
              {/* Future: Add validation message for contactNumber if using react-hook-form */}
            </div>
            
            <div className="border-t pt-6 space-y-2">
                <h3 className="text-lg font-medium flex items-center"><ShieldCheck className="mr-2 h-5 w-5 text-primary" />Change Password</h3>
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
                placeholder="Confirm new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)} 
                disabled={isUpdating}
                autoComplete="new-password"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full sm:w-auto" disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Update Profile & Password"}
            </Button>
          </CardFooter>
        </form>
      </Card>
      {/* 
        Phase 1 Data Storage: Basic profile info (email, name derived from auth) shown. Contact number is local state.
        Phase 2 (Future-Ready):
        - A 'users' or 'managers' collection in Firestore would store additional profile details.
        - Fields could include: name, contactNumber, role, profileImageURL etc., linked by Firebase Auth UID.
        - Updating contact number here would write to that Firestore document.
        - Password changes are handled by Firebase Auth directly.
      */}
    </>
  );
}
