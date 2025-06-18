
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
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, Timestamp, collection, query, where, limit, getDocs } from "firebase/firestore"; 

/**
 * @fileOverview My Profile page for authenticated users (Admin and Store Manager).
 * Admins can additionally manage company details.
 * Managers view company details as read-only, fetched from an admin's profile.
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
  const [isUpdating, setIsUpdating] = useState(false);

  // Personal details state
  const [name, setName] = useState(""); 
  const [contactNumber, setContactNumber] = useState("");

  // Company details state (used by admin for editing, and as fallback)
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyContact, setCompanyContact] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");

  // State to hold company details fetched from Admin, for Manager's display
  const [companyDetailsForDisplay, setCompanyDetailsForDisplay] = useState<Partial<UserProfile>>({});

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid); 
          const userDoc = await getDoc(userDocRef);
          
          let profileData: UserProfile | null = null;

          if (userDoc.exists()) {
            const userData = userDoc.data();
            profileData = {
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
          } else {
            let determinedRole: 'admin' | 'store_manager' | undefined = undefined;
            if (firebaseUser.email === 'admin@kbms.com') {
              determinedRole = 'admin';
            }
            profileData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "N/A",
              name: firebaseUser.displayName || firebaseUser.email || "User", 
              contactNumber: "", role: determinedRole, 
              companyName: "", companyAddress: "", companyContact: "", companyGstin: "", companyLogoUrl: "",
            };
            const dataToSet: Partial<UserProfile> = {
                name: profileData.name, email: profileData.email, uid: firebaseUser.uid,
                createdAt: serverTimestamp() as Timestamp, updatedAt: serverTimestamp() as Timestamp,
                ...(determinedRole && { role: determinedRole })
            };
            await setDoc(userDocRef, dataToSet, { merge: true });
            toast({ title: "Profile Initialized", description: `Your basic profile${determinedRole ? ` with role '${determinedRole}'` : ''} has been created.`, variant: "default"});
          }

          setUserProfile(profileData);
          setName(profileData.name); 
          setContactNumber(profileData.contactNumber); 

          if (profileData.role === 'admin') {
            setCompanyName(profileData.companyName || "");
            setCompanyAddress(profileData.companyAddress || "");
            setCompanyContact(profileData.companyContact || "");
            setCompanyGstin(profileData.companyGstin || "");
            setCompanyLogoUrl(profileData.companyLogoUrl || "");
          } else if (profileData.role === 'store_manager') {
            // Fetch company details from an admin profile for manager display
            try {
              const adminQuery = query(collection(db, "users"), where("role", "==", "admin"), limit(1));
              const adminSnapshot = await getDocs(adminQuery);
              if (!adminSnapshot.empty) {
                const adminData = adminSnapshot.docs[0].data();
                setCompanyDetailsForDisplay({
                  companyName: adminData.companyName || "",
                  companyAddress: adminData.companyAddress || "",
                  companyContact: adminData.companyContact || "",
                  companyGstin: adminData.companyGstin || "",
                  companyLogoUrl: adminData.companyLogoUrl || "",
                });
              } else {
                console.warn("MyProfilePage: No admin user found to fetch company details for manager view.");
                toast({ title: "Company Info Unavailable", description: "Could not load company details. Please contact an admin.", variant: "default" });
              }
            } catch (adminFetchError) {
              console.error("Error fetching admin company details for manager view:", adminFetchError);
              toast({ title: "Company Info Error", description: "Failed to load company details.", variant: "destructive" });
            }
          }
          
        } catch (error) {
            console.error("Error fetching/initializing user profile from Firestore:", error);
            toast({ title: "Profile Load Error", description: "Could not load your full profile details.", variant: "destructive"});
            const fallbackProfile: UserProfile = {
              uid: firebaseUser.uid, email: firebaseUser.email || "N/A", name: firebaseUser.displayName || firebaseUser.email || "User", contactNumber: "", role: undefined,
              companyName: "", companyAddress: "", companyContact: "", companyGstin: "", companyLogoUrl: "",
            };
            setUserProfile(fallbackProfile); setName(fallbackProfile.name); setContactNumber(fallbackProfile.contactNumber);
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

    const isEffectivelyAdmin = userProfile.role === 'admin';

    const hasPersonalChanges = name !== userProfile.name || contactNumber !== userProfile.contactNumber;
    let hasCompanyChanges = false;

    if (isEffectivelyAdmin) {
        hasCompanyChanges = companyName !== (userProfile.companyName || "") ||
                            companyAddress !== (userProfile.companyAddress || "") ||
                            companyContact !== (userProfile.companyContact || "") ||
                            companyGstin !== (userProfile.companyGstin || "") ||
                            companyLogoUrl !== (userProfile.companyLogoUrl || "");
    }

    if (hasPersonalChanges || (isEffectivelyAdmin && hasCompanyChanges)) {
      try {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const profileDataToSave: Partial<UserProfile> = {
          name: name,
          contactNumber: contactNumber,
          updatedAt: serverTimestamp() as Timestamp, 
          email: userProfile.email, // Ensure email is preserved
          role: userProfile.role,   // Ensure role is preserved
          uid: userProfile.uid,     // Ensure uid is preserved
        };
        
        if (isEffectivelyAdmin) {
            profileDataToSave.companyName = companyName;
            profileDataToSave.companyAddress = companyAddress;
            profileDataToSave.companyContact = companyContact;
            profileDataToSave.companyGstin = companyGstin;
            profileDataToSave.companyLogoUrl = companyLogoUrl;
        }
        
        await setDoc(userDocRef, profileDataToSave, { merge: true });
        
        setUserProfile(prev => prev ? {
            ...prev, 
            name: name, 
            contactNumber: contactNumber,
            ...(isEffectivelyAdmin && {
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

  const isEffectivelyAdmin = userProfile.role === 'admin';

  return (
    <>
      <PageHeader title="My Profile" description="View and update your personal & company information." icon={UserCircle}/>
      <form onSubmit={handleUpdateProfile}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                            <Input 
                                id="companyName" 
                                placeholder="Your Company Name" 
                                value={isEffectivelyAdmin ? companyName : (companyDetailsForDisplay.companyName || "")} 
                                onChange={(e) => isEffectivelyAdmin && setCompanyName(e.target.value)} 
                                disabled={isUpdating || !isEffectivelyAdmin} className="text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="companyContact" className="flex items-center text-sm"><Phone className="mr-2 h-4 w-4 text-muted-foreground"/>Company Contact</Label>
                            <Input 
                                id="companyContact" 
                                placeholder="Company Phone or Email" 
                                value={isEffectivelyAdmin ? companyContact : (companyDetailsForDisplay.companyContact || "")} 
                                onChange={(e) => isEffectivelyAdmin && setCompanyContact(e.target.value)} 
                                disabled={isUpdating || !isEffectivelyAdmin} className="text-sm"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="companyAddress" className="flex items-center text-sm"><Globe className="mr-2 h-4 w-4 text-muted-foreground"/>Company Address</Label>
                        <Textarea 
                            id="companyAddress" 
                            placeholder="Full Company Address" 
                            value={isEffectivelyAdmin ? companyAddress : (companyDetailsForDisplay.companyAddress || "")} 
                            onChange={(e) => isEffectivelyAdmin && setCompanyAddress(e.target.value)} 
                            disabled={isUpdating || !isEffectivelyAdmin} rows={2} className="text-sm"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="companyGstin" className="flex items-center text-sm"><FileTextIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Company GSTIN (Optional)</Label>
                            <Input 
                                id="companyGstin" 
                                placeholder="Company GSTIN" 
                                value={isEffectivelyAdmin ? companyGstin : (companyDetailsForDisplay.companyGstin || "")} 
                                onChange={(e) => isEffectivelyAdmin && setCompanyGstin(e.target.value)} 
                                disabled={isUpdating || !isEffectivelyAdmin} className="text-sm"
                            />
                        </div>
                        <div className="space-y-1.5">
                             <Label htmlFor="companyLogoUrl" className="flex items-center text-sm"><ImageIcon className="mr-2 h-4 w-4 text-muted-foreground"/>Company Logo URL (Optional)</Label>
                             <Input 
                                id="companyLogoUrl" 
                                placeholder="https://example.com/logo.png" 
                                value={isEffectivelyAdmin ? companyLogoUrl : (companyDetailsForDisplay.companyLogoUrl || "")} 
                                onChange={(e) => isEffectivelyAdmin && setCompanyLogoUrl(e.target.value)} 
                                disabled={isUpdating || !isEffectivelyAdmin} className="text-sm"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

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
