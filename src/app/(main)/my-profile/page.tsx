
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

export interface UserProfile {
  uid: string; 
  authUid?: string; 
  name: string; 
  email: string; 
  contactNumber: string; 
  role?: 'admin' | 'store_manager'; 
  companyId: string; 
  activeSessionId?: string;

  companyName?: string | null; // Optional for general profile, but expected for admin
  companyAddress?: string | null;
  companyContact?: string | null; 
  companyGstin?: string | null;
  companyLogoUrl?: string | null;
  
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  status?: string; 
}

const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};


export default function MyProfilePage() {
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const [name, setName] = useState(""); 
  const [contactNumber, setContactNumber] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyContact, setCompanyContact] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");

  const [companyDetailsForDisplay, setCompanyDetailsForDisplay] = useState<Partial<UserProfile>>({
    companyName: "", companyAddress: "", companyContact: "", companyGstin: "", companyLogoUrl: ""
  });

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
          let currentCompanyIdFromCookie = getCookie('companyId');

          if (userDoc.exists()) {
            const userData = userDoc.data();
            profileData = {
              uid: firebaseUser.uid,
              authUid: firebaseUser.uid,
              email: firebaseUser.email || "N/A",
              name: userData.name || firebaseUser.displayName || "User", 
              contactNumber: userData.contactNumber || "",
              role: userData.role, 
              companyId: userData.companyId || currentCompanyIdFromCookie || (userData.role === 'admin' ? firebaseUser.uid : ''), 
              companyName: userData.companyName || "",
              companyAddress: userData.companyAddress || "",
              companyContact: userData.companyContact || "",
              companyGstin: userData.companyGstin || "",
              companyLogoUrl: userData.companyLogoUrl || "",
              createdAt: userData.createdAt,
              updatedAt: userData.updatedAt,
              status: userData.status,
              activeSessionId: userData.activeSessionId,
            };
             if (profileData.companyId && profileData.companyId !== currentCompanyIdFromCookie && typeof document !== 'undefined') {
                document.cookie = `companyId=${profileData.companyId}; path=/; max-age=${60*60*24*7}`;
                window.dispatchEvent(new CustomEvent('userSessionChanged'));
             }


          } else { 
            console.warn(`MyProfile: User document for ${firebaseUser.uid} not found. Attempting to create basic profile.`);
            let determinedRole: 'admin' | 'store_manager' | undefined = getCookie('userRole') as UserProfile['role'] || undefined;
            
            // If role still unknown, try a default for safety (e.g. specific admin email)
            if (!determinedRole && firebaseUser.email === 'admin@kbms.com') { 
              determinedRole = 'admin';
            }

            const effectiveCompanyId = currentCompanyIdFromCookie || (determinedRole === 'admin' ? firebaseUser.uid : ''); 
            
            if (!effectiveCompanyId && determinedRole === 'store_manager') {
                console.error("MyProfile: Critical - Cannot create profile for manager without a companyId. User should re-login or admin should check manager setup.");
                toast({title: "Profile Initialization Error", description: "Manager profile cannot be set up without a company. Please re-login or contact admin.", variant: "destructive"});
                setIsLoading(false);
                return;
            }
             if (!effectiveCompanyId && determinedRole === 'admin') {
                console.warn("MyProfile: Admin's companyId not found in cookie, defaulting to UID for new admin setup.");
            }


            profileData = {
              uid: firebaseUser.uid, authUid: firebaseUser.uid,
              email: firebaseUser.email || "N/A",
              name: firebaseUser.displayName || firebaseUser.email || "User", 
              contactNumber: "", role: determinedRole, 
              companyId: effectiveCompanyId,
              // For a new admin, these company details will be blank initially and they'll fill them in.
              companyName: "", companyAddress: "", companyContact: "", companyGstin: "", companyLogoUrl: "",
            };
            const dataToSet: Partial<UserProfile> = {
                name: profileData.name, email: profileData.email, uid: firebaseUser.uid, authUid: firebaseUser.uid,
                companyId: profileData.companyId, // Must have companyId
                createdAt: serverTimestamp() as Timestamp, updatedAt: serverTimestamp() as Timestamp,
                ...(determinedRole && { role: determinedRole }) 
            };
            // Only if companyId is present, attempt to set the doc
            if (profileData.companyId) {
                await setDoc(userDocRef, dataToSet, { merge: true });
                toast({ title: "Profile Initialized", description: `Your basic profile has been set up.`, variant: "default"});
            } else if (determinedRole === 'admin') {
                 // This case implies a new admin whose companyId is their UID, which should be fine
                await setDoc(userDocRef, dataToSet, { merge: true });
                toast({ title: "Admin Profile Initialized", description: `Your admin profile has been set up. Please fill in company details.`, variant: "default"});
            }
          }

          setUserProfile(profileData);
          setName(profileData?.name || ""); 
          setContactNumber(profileData?.contactNumber || ""); 

          if (profileData?.role === 'admin') {
            setCompanyName(profileData.companyName || "");
            setCompanyAddress(profileData.companyAddress || "");
            setCompanyContact(profileData.companyContact || "");
            setCompanyGstin(profileData.companyGstin || "");
            setCompanyLogoUrl(profileData.companyLogoUrl || "");
          } else if (profileData?.role === 'store_manager' && profileData.companyId) {
            try {
              // Fetch company details from the admin user associated with this manager's companyId
              const adminQuery = query(collection(db, "users"), where("role", "==", "admin"), where("companyId", "==", profileData.companyId), limit(1));
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
                console.warn(`MyProfilePage: No admin user found with companyId ${profileData.companyId} for manager view.`);
                toast({ title: "Company Info Unavailable", description: "Could not load company details. Admin may need to set them up or check company ID.", variant: "default" });
                setCompanyDetailsForDisplay({ companyName: "N/A", companyAddress: "N/A", companyContact: "N/A", companyGstin: "N/A", companyLogoUrl: "" });
              }
            } catch (adminFetchError) {
              console.error("Error fetching admin company details for manager view:", adminFetchError);
              toast({ title: "Company Info Error", description: "Failed to load company details.", variant: "destructive" });
              setCompanyDetailsForDisplay({ companyName: "Error loading", companyAddress: "", companyContact: "", companyGstin: "", companyLogoUrl: "" });
            }
          }
          
        } catch (error) {
            console.error("Error fetching/initializing user profile from Firestore:", error);
            toast({ title: "Profile Load Error", description: "Could not load your full profile details.", variant: "destructive"});
            const fallbackProfile: UserProfile = {
              uid: firebaseUser.uid, email: firebaseUser.email || "N/A", name: firebaseUser.displayName || firebaseUser.email || "User", contactNumber: "", role: undefined,
              companyId: currentCompanyIdFromCookie || firebaseUser.uid, 
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
     if (!userProfile.companyId) {
      toast({ title: "Profile Error", description: "Company ID is missing from your profile. Cannot update.", variant: "destructive" });
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
          email: userProfile.email, 
          role: userProfile.role,   
          uid: userProfile.uid,
          authUid: userProfile.authUid || firebaseUser.uid,
          companyId: userProfile.companyId, 
        };
        
        if (isEffectivelyAdmin) {
            profileDataToSave.companyName = companyName || null;
            profileDataToSave.companyAddress = companyAddress || null;
            profileDataToSave.companyContact = companyContact || null;
            profileDataToSave.companyGstin = companyGstin || null;
            profileDataToSave.companyLogoUrl = companyLogoUrl || null;
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
                        {userProfile.companyId && <p className="text-xs text-muted-foreground pt-1">Company ID: <span className="font-semibold">{userProfile.companyId}</span></p>}
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="name" className="flex items-center text-sm"><UserCircle className="mr-2 h-4 w-4 text-muted-foreground"/>Display Name</Label>
                        <Input id="name" placeholder="Your display name" value={name} onChange={(e) => setName(e.target.value)} disabled={isUpdating} autoComplete="name" className="text-sm"/>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="contactNumber" className="flex items-center text-sm"><Phone className="mr-2 h-4 w-4 text-muted-foreground"/>Personal Contact Number</Label>
                        <Input id="contactNumber" placeholder="Your contact number" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} disabled={isUpdating} autoComplete="tel" className="text-sm"/>
                    </div>
                </CardContent>
            </Card>

            <Card className="md:col-span-2 shadow-lg rounded-xl">
                <CardHeader>
                    <CardTitle className="font-headline text-foreground text-xl">Company Information</CardTitle>
                    <CardDescription className="text-xs flex items-center">
                       <Info className="h-3 w-3 mr-1.5 text-muted-foreground"/>
                       This information will appear on generated invoices. {isEffectivelyAdmin ? "Editable by you (Admin)." : "View-only. Set by Admin."}
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
                            <Label htmlFor="companyContact" className="flex items-center text-sm"><Phone className="mr-2 h-4 w-4 text-muted-foreground"/>Company Contact Phone</Label>
                            <Input 
                                id="companyContact" 
                                placeholder="Company Phone" 
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
                     {!isEffectivelyAdmin && (companyDetailsForDisplay.companyName === "" || companyDetailsForDisplay.companyName === "N/A" || companyDetailsForDisplay.companyName === "Error loading") && (
                        <p className="text-xs text-muted-foreground text-center pt-2">Company details are not yet configured by an administrator or could not be loaded.</p>
                    )}
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
    
