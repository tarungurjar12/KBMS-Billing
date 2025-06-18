
"use client"; 

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { UserCircle, ShieldCheck, Mail, Phone, Building, Globe, FileTextIcon, Image as ImageIcon, Info } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { auth, db } from '@/lib/firebase/firebaseConfig'; 
import { onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, Timestamp } from "firebase/firestore"; 

/**
 * @fileOverview My Profile page for authenticated users (Admin and Store Manager).
 * Admins can additionally manage company details.
 */

export interface UserProfile {
  uid: string; 
  name: string; 
  email: string; 
  contactNumber: string; 
  role?: 'admin' | 'store_manager'; 
  // Company details (for admin role)
  companyName?: string;
  companyAddress?: string;
  companyContact?: string;
  companyGstin?: string;
  companyLogoUrl?: string;
  // Timestamps from Firestore
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  status?: string; // if used for managers
  authUid?: string; // if used for managers
}

export default function MyProfilePage() {
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Personal details state
  const [name, setName] = useState(""); 
  const [contactNumber, setContactNumber] = useState("");

  // Company details state
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyContact, setCompanyContact] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");

  // Password change state
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
            console.log(`MyProfilePage: Fetched user data for ${firebaseUser.email}:`, userData); // Log fetched data
            const profile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "N/A",
              name: userData.name || firebaseUser.displayName || "User", 
              contactNumber: userData.contactNumber || "",
              role: userData.role, 
              companyName: userData.companyName || "",
              companyAddress: userData.companyAddress || "",
              companyContact: userData.companyContact || "",
              companyGstin: userData.companyGstin || "",
              companyLogoUrl: userData.companyLogoUrl || "",
              createdAt: userData.createdAt,
              updatedAt: userData.updatedAt,
              status: userData.status,
              authUid: userData.authUid,
            };
            setUserProfile(profile);
            setName(profile.name); 
            setContactNumber(profile.contactNumber); 
            setCompanyName(profile.companyName || "");
            setCompanyAddress(profile.companyAddress || "");
            setCompanyContact(profile.companyContact || "");
            setCompanyGstin(profile.companyGstin || "");
            setCompanyLogoUrl(profile.companyLogoUrl || "");
            
          } else {
            console.log(`MyProfilePage: No user document found for ${firebaseUser.email}. Creating basic profile.`);
            // If user doc doesn't exist, create a basic one
            // Determine role based on email for initial setup if it's a known admin email
            let determinedRole: 'admin' | 'store_manager' | undefined = undefined;
            if (firebaseUser.email === 'admin@kbms.com') { // Specific check for the main admin email
              determinedRole = 'admin';
              console.log(`MyProfilePage: Auto-assigning role 'admin' for ${firebaseUser.email} during initial profile creation.`);
            }
            // Add other role determination logic if necessary e.g. for store_manager from email pattern.
            // else if (firebaseUser.email?.includes('manager@')) {
            // determinedRole = 'store_manager';
            // }


            const profile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "N/A",
              name: firebaseUser.displayName || firebaseUser.email || "User", 
              contactNumber: "",
              role: determinedRole, 
              companyName: "", companyAddress: "", companyContact: "", companyGstin: "", companyLogoUrl: "",
            };
            setUserProfile(profile);
            setName(profile.name);
            setContactNumber(profile.contactNumber);
            
            const dataToSet: Partial<UserProfile> = {
                name: profile.name,
                email: profile.email,
                uid: firebaseUser.uid,
                createdAt: serverTimestamp() as Timestamp,
                updatedAt: serverTimestamp() as Timestamp,
            };
            if (determinedRole) {
                dataToSet.role = determinedRole;
            }

            try {
                await setDoc(userDocRef, dataToSet, { merge: true }); // Use userDocRef directly
                if (determinedRole) {
                    toast({ title: "Profile Initialized", description: `Your basic profile with role '${determinedRole}' has been created. Please complete your details.`, variant: "default"});
                } else {
                    toast({ title: "Profile Initialized", description: "Your basic profile has been created. Role needs to be assigned by an admin.", variant: "default"});
                }
            } catch (initError) {
                console.error("Error initializing user profile in Firestore:", initError);
                toast({ title: "Profile Initialization Error", description: "Could not create your initial profile.", variant: "destructive"});
            }
          }
        } catch (error) {
            console.error("Error fetching user profile from Firestore:", error);
            toast({ title: "Profile Load Error", description: "Could not load your full profile details.", variant: "destructive"});
            const profile: UserProfile = { // Fallback
              uid: firebaseUser.uid, email: firebaseUser.email || "N/A", name: firebaseUser.displayName || firebaseUser.email || "User", contactNumber: "", role: undefined,
              companyName: "", companyAddress: "", companyContact: "", companyGstin: "", companyLogoUrl: "",
            };
            setUserProfile(profile); setName(profile.name); setContactNumber(profile.contactNumber);
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
    let profileInfoUpdated = false;
    let passwordChanged = false;

    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !userProfile) { 
      toast({ title: "Authentication Error", description: "User not authenticated or profile data missing.", variant: "destructive" });
      setIsUpdating(false);
      return;
    }

    const hasPersonalChanges = name !== userProfile.name || contactNumber !== userProfile.contactNumber;
    let hasCompanyChanges = false;
    const currentRoleIsAdmin = userProfile.role === 'admin';

    if (currentRoleIsAdmin) {
        hasCompanyChanges = companyName !== (userProfile.companyName || "") ||
                            companyAddress !== (userProfile.companyAddress || "") ||
                            companyContact !== (userProfile.companyContact || "") ||
                            companyGstin !== (userProfile.companyGstin || "") ||
                            companyLogoUrl !== (userProfile.companyLogoUrl || "");
    }

    if (hasPersonalChanges || (currentRoleIsAdmin && hasCompanyChanges)) {
      try {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const profileDataToSave: Partial<UserProfile> = {
          name: name,
          contactNumber: contactNumber,
          updatedAt: serverTimestamp() as Timestamp, 
        };
        
        if (currentRoleIsAdmin) {
            profileDataToSave.companyName = companyName;
            profileDataToSave.companyAddress = companyAddress;
            profileDataToSave.companyContact = companyContact;
            profileDataToSave.companyGstin = companyGstin;
            profileDataToSave.companyLogoUrl = companyLogoUrl;
        }
        
        // Ensure existing essential fields like email and role are preserved if not being changed here
        // This is mainly for if the doc was just created and these are being set for the first time effectively
        if (userProfile.email && !profileDataToSave.email) profileDataToSave.email = userProfile.email;
        if (userProfile.role && !profileDataToSave.role) profileDataToSave.role = userProfile.role;
        if (userProfile.uid && !profileDataToSave.uid) profileDataToSave.uid = userProfile.uid;


        await setDoc(userDocRef, profileDataToSave, { merge: true });
        
        setUserProfile(prev => prev ? {
            ...prev, 
            name: name, 
            contactNumber: contactNumber,
            ...(currentRoleIsAdmin && {
                companyName, companyAddress, companyContact, companyGstin, companyLogoUrl
            })
        } : null); 
        profileInfoUpdated = true;
      } catch (error) {
        console.error("Error updating profile in Firestore: ", error);
        toast({ title: "Profile Update Failed", description: "Failed to update your information in the database.", variant: "destructive" });
      }
    }

    if (newPassword) {
      if (newPassword !== confirmNewPassword) {
        toast({ title: "Password Mismatch", description: "New passwords do not match.", variant: "destructive" });
        setIsUpdating(false); return;
      }
      if (!currentPassword) {
        toast({ title: "Current Password Required", description: "Enter current password to set a new one.", variant: "destructive" });
        setIsUpdating(false); return;
      }

      try {
        if (firebaseUser.email) { 
            const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword);
            await reauthenticateWithCredential(firebaseUser, credential);
            await updatePassword(firebaseUser, newPassword); 
            passwordChanged = true;
            setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword("");
        } else { throw new Error("User email not found for re-authentication."); }
      } catch (error: any) {
        console.error("Error updating password: ", error);
        let errMsg = "Failed to update password.";
        if (error.code === 'auth/wrong-password') errMsg = "Incorrect current password.";
        else if (error.code === 'auth/weak-password') errMsg = "New password is too weak (min. 6 characters).";
        else if (error.code === 'auth/requires-recent-login') errMsg = "Re-login required for this sensitive operation.";
        toast({ title: "Password Change Failed", description: errMsg, variant: "destructive" });
        setIsUpdating(false); return; 
      }
    }

    if (profileInfoUpdated && passwordChanged) toast({ title: "Profile & Password Updated", description: "Information and password updated." });
    else if (profileInfoUpdated) toast({ title: "Profile Updated", description: "Your information has been updated." });
    else if (passwordChanged) toast({ title: "Password Changed", description: "Password successfully updated." });
    else if (!hasPersonalChanges && !hasCompanyChanges && !newPassword) toast({ title: "No Changes", description: "No information was changed." });
    
    setIsUpdating(false);
  };
  
  if (isLoading) {
    return <PageHeader title="My Profile" description="Loading your profile..." icon={UserCircle} />;
  }

  if (!userProfile) {
    return <PageHeader title="My Profile" description="Please log in to view your profile." icon={UserCircle} />;
  }

  const isEffectivelyAdmin = userProfile.role === 'admin'; // Use this for disabling inputs

  return (
    <>
      <PageHeader title="My Profile" description="View and update your personal & company information." icon={UserCircle}/>
      <form onSubmit={handleUpdateProfile}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Personal Details Card */}
            <Card className="md:col-span-1 shadow-lg rounded-xl">
                <CardHeader>
                    <CardTitle className="font-headline text-foreground text-xl">Personal Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="email" className="flex items-center text-sm"><Mail className="mr-2 h-4 w-4 text-muted-foreground"/>Email (Login ID)</Label>
                        <Input id="email" value={userProfile.email} disabled readOnly className="bg-muted/50 text-sm"/>
                        {userProfile.role && <p className="text-xs text-muted-foreground pt-1">Role: <span className="font-semibold capitalize">{userProfile.role.replace('_', ' ')}</span></p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="name" className="flex items-center text-sm"><UserCircle className="mr-2 h-4 w-4 text-muted-foreground"/>Display Name</Label>
                        <Input id="name" placeholder="Your display name" value={name} onChange={(e) => setName(e.target.value)} disabled={isUpdating} autoComplete="name" className="text-sm"/>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="contactNumber" className="flex items-center text-sm"><Phone className="mr-2 h-4 w-4 text-muted-foreground"/>Contact Number</Label>
                        <Input id="contactNumber" placeholder="Your contact number" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} disabled={isUpdating} autoComplete="tel" className="text-sm"/>
                    </div>
                </CardContent>
            </Card>

            {/* Company Information Card (Visible to both, editable by Admin only) */}
            <Card className="md:col-span-2 shadow-lg rounded-xl">
                <CardHeader>
                    <CardTitle className="font-headline text-foreground text-xl">Company Information</CardTitle>
                    <CardDescription className="text-xs flex items-center">
                       <Info className="h-3 w-3 mr-1.5 text-muted-foreground"/>
                       This information will appear on generated invoices. {isEffectivelyAdmin ? "Editable by you (Admin)." : "View-only for Store Managers."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="companyName" className="flex items-center text-sm"><Building className="mr-2 h-4 w-4 text-muted-foreground"/>Company Name</Label>
                            <Input id="companyName" placeholder="Your Company Name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={isUpdating || !isEffectivelyAdmin} className="text-sm"/>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="companyContact" className="flex items-center text-sm"><Phone className="mr-2 h-4 w-4 text-muted-foreground"/>Company Contact</Label>
                            <Input id="companyContact" placeholder="Company Phone or Email" value={companyContact} onChange={(e) => setCompanyContact(e.target.value)} disabled={isUpdating || !isEffectivelyAdmin} className="text-sm"/>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="companyAddress" className="flex items-center text-sm"><Globe className="mr-2 h-4 w-4 text-muted-foreground"/>Company Address</Label>
                        <Textarea id="companyAddress" placeholder="Full Company Address" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} disabled={isUpdating || !isEffectivelyAdmin} rows={2} className="text-sm"/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="companyGstin" className="flex items-center text-sm"><FileTextIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Company GSTIN (Optional)</Label>
                            <Input id="companyGstin" placeholder="Company GSTIN" value={companyGstin} onChange={(e) => setCompanyGstin(e.target.value)} disabled={isUpdating || !isEffectivelyAdmin} className="text-sm"/>
                        </div>
                        <div className="space-y-1.5">
                             <Label htmlFor="companyLogoUrl" className="flex items-center text-sm"><ImageIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Company Logo URL (Optional)</Label>
                             <Input id="companyLogoUrl" placeholder="https://example.com/logo.png" value={companyLogoUrl} onChange={(e) => setCompanyLogoUrl(e.target.value)} disabled={isUpdating || !isEffectivelyAdmin} className="text-sm"/>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Password Change Card */}
        <Card className="mt-6 shadow-lg rounded-xl">
            <CardHeader>
                <CardTitle className="font-headline text-foreground text-xl flex items-center"><ShieldCheck className="mr-2 h-5 w-5 text-primary" />Change Password</CardTitle>
                <CardDescription className="text-xs">Leave fields blank if you do not want to change password.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="currentPassword">Current Password</Label>
                        <Input id="currentPassword" type="password" placeholder="Required to change" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={isUpdating} autoComplete="current-password" className="text-sm"/>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input id="newPassword" type="password" placeholder="Min. 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isUpdating} autoComplete="new-password" className="text-sm"/>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                        <Input id="confirmNewPassword" type="password" placeholder="Re-enter new password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} disabled={isUpdating} autoComplete="new-password" className="text-sm"/>
                    </div>
                </div>
            </CardContent>
        </Card>

        <CardFooter className="mt-6 py-4 px-0 flex justify-end">
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={isUpdating || isLoading}>
              {isUpdating ? "Updating..." : "Save All Changes"}
            </Button>
        </CardFooter>
      </form>
    </>
  );
}


    