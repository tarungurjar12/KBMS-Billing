
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { UserCog, PlusCircle, MoreHorizontal, ShieldAlert, ShieldCheck, KeyRound, Users as UsersIcon } from "lucide-react"; 
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/firebaseConfig';
import { doc, setDoc, getDocs, collection, updateDoc, serverTimestamp, query, orderBy, Timestamp, where } from 'firebase/firestore'; 

export interface Manager {
  id: string; 
  name: string;
  email: string; 
  status: "Active" | "Frozen"; 
  authUid: string; 
  role: "store_manager"; 
  companyId: string; 
  createdAt?: Timestamp; 
  updatedAt?: Timestamp;
}

const managerSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  email: z.string().email({ message: "Invalid email address. This will be their login ID."}),
  password: z.string().min(6, { message: "Password must be at least 6 characters for security." }),
});

type ManagerFormValues = z.infer<typeof managerSchema>;

const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};


export default function ManageManagersPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddManagerDialogOpen, setIsAddManagerDialogOpen] = useState(false);
  const [managerToToggleStatus, setManagerToToggleStatus] = useState<Manager | null>(null);
  const [isToggleStatusConfirmOpen, setIsToggleStatusConfirmOpen] = useState(false);
  const [managerToResetPassword, setManagerToResetPassword] = useState<Manager | null>(null);
  const [isResetPasswordConfirmOpen, setIsResetPasswordConfirmOpen] = useState(false);
  const [currentAdminCompanyId, setCurrentAdminCompanyId] = useState<string | undefined>(undefined);

  const { toast } = useToast();

  const form = useForm<ManagerFormValues>({
    resolver: zodResolver(managerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  useEffect(() => {
    const companyIdFromCookie = getCookie('companyId');
    if (companyIdFromCookie) {
        setCurrentAdminCompanyId(companyIdFromCookie);
    } else {
        toast({ title: "Error", description: "Admin's Company ID not found. Please re-login as an admin.", variant: "destructive"});
        setIsLoading(false); 
    }
  }, [toast]);


  const fetchManagers = useCallback(async () => {
    if (!currentAdminCompanyId) {
        setIsLoading(false);
        setManagers([]); 
        return;
    }
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "users"), 
        where("role", "==", "store_manager"), 
        where("companyId", "==", currentAdminCompanyId), 
        orderBy("name", "asc")
      );
      const querySnapshot = await getDocs(q);
      const fetchedManagers = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id, 
          name: data.name,
          email: data.email,
          status: data.status || "Active", 
          authUid: data.authUid, 
          role: data.role,
          companyId: data.companyId, 
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        } as Manager;
      });
      setManagers(fetchedManagers);
    } catch (error: any) {
      console.error("Error fetching managers: ", error);
       if (error.code === 'failed-precondition') {
        toast({
            title: "Database Index Required",
            description: `A query for managers failed. Please create the required Firestore index for 'users' (companyId ASC, role ASC, name ASC). Check your browser's developer console for a Firebase link.`,
            variant: "destructive",
            duration: 15000,
        });
      } else {
        toast({ title: "Database Error", description: `Could not load managers: ${error.message}`, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast, currentAdminCompanyId]);

  useEffect(() => {
    if (currentAdminCompanyId) {
        fetchManagers();
    }
  }, [fetchManagers, currentAdminCompanyId]);

  const handleAddManagerSubmit = async (values: ManagerFormValues) => {
    if (!currentAdminCompanyId) {
        toast({ title: "Error", description: "Cannot add manager: Admin company ID is missing. Please re-login.", variant: "destructive"});
        return;
    }

    let newUserId = null; 
    try {
      const managerEmailQuery = query(collection(db, "users"), 
        where("email", "==", values.email),
        where("companyId", "==", currentAdminCompanyId), // Check only within the same company
        where("role", "==", "store_manager")
      );
      const managerEmailSnapshot = await getDocs(managerEmailQuery);
      if (!managerEmailSnapshot.empty) {
          form.setError("email", {type: "manual", message: "This email is already in use by another manager in your company."});
          return;
      }


      console.log(`ManageManagersPage: Attempting to create Firebase Auth user for email: ${values.email}`);
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      newUserId = userCredential.user.uid;
      console.log(`ManageManagersPage: Firebase Auth user created successfully. UID: ${newUserId}`);

      if (!newUserId) {
        console.error("ManageManagersPage: Firebase Auth user UID is unexpectedly null or empty after creation.");
        throw new Error("Firebase Auth user UID is unexpectedly null or empty after creation.");
      }
      
      // Ensure Manager interface matches this structure, especially companyId
      const newManagerData: Omit<Manager, 'id' | 'createdAt' | 'updatedAt'> &amp; { createdAt: Timestamp, updatedAt: Timestamp } = { 
        name: values.name, 
        email: values.email, 
        status: "Active", 
        authUid: newUserId, 
        role: "store_manager", 
        companyId: currentAdminCompanyId, 
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
      };
      
      const userDocRef = doc(db, "users", newUserId);
      console.log(`ManageManagersPage: Attempting to set Firestore document at path: users/${newUserId} with data:`, newManagerData);
      await setDoc(userDocRef, newManagerData); 
      console.log(`ManageManagersPage: Firestore document successfully set for manager ${values.name} (UID: ${newUserId}).`);
      
      toast({
        title: "Manager Added Successfully",
        description: `${values.name} can now log in.`,
      });
      fetchManagers(); 
      form.reset(); 
      setIsAddManagerDialogOpen(false); 
    } catch (error: any) {
      console.error(`ManageManagersPage: Error adding manager for email ${values.email}. Auth UID (if created): ${newUserId || 'N/A'}. Full Error:`, error);
      let errorMessage = `Failed to add manager. Code: ${error.code || 'UNKNOWN'}. Message: ${error.message || 'An unexpected error occurred.'}`;
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email address is already registered globally. Please use a different email.";
         form.setError("email", { type: "manual", message: errorMessage });
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The password is too weak. Please use a stronger password (at least 6 characters).";
      }
      toast({ title: "Adding Manager Failed", description: errorMessage, variant: "destructive", duration: 9000 });
    }
  };

  const openToggleStatusDialog = (manager: Manager) => {
    setManagerToToggleStatus(manager);
    setIsToggleStatusConfirmOpen(true);
  };

  const confirmToggleStatus = async () => {
    if (!managerToToggleStatus) return;
    const newStatus = managerToToggleStatus.status === "Active" ? "Frozen" : "Active";
    try {
      const managerRef = doc(db, "users", managerToToggleStatus.authUid); 
      await updateDoc(managerRef, { status: newStatus, updatedAt: serverTimestamp() });
      toast({
        title: `Manager Account ${newStatus === "Active" ? "Activated" : "Frozen"}`,
        description: `${managerToToggleStatus.name}'s account status is now ${newStatus.toLowerCase()}.`,
      });
      fetchManagers(); 
    } catch (error: any) {
      console.error("Error updating manager status: ", error);
      toast({ title: "Status Update Error", description: `Failed to update manager status: ${error.message}`, variant: "destructive" });
    } finally {
        setIsToggleStatusConfirmOpen(false); 
        setManagerToToggleStatus(null);
    }
  };

  const openResetPasswordDialog = (manager: Manager) => {
    setManagerToResetPassword(manager);
    setIsResetPasswordConfirmOpen(true);
  };

  const confirmResetPassword = async () => {
    if (!managerToResetPassword) return;
    try {
      await sendPasswordResetEmail(auth, managerToResetPassword.email);
      toast({
        title: "Password Reset Email Sent",
        description: `A password reset email has been successfully sent to ${managerToResetPassword.email}.`,
      });
    } catch (error: any) {
      console.error("Error sending password reset email: ", error);
      toast({ title: "Password Reset Error", description: error.message || "Failed to send password reset email. Please try again.", variant: "destructive" });
    } finally {
        setIsResetPasswordConfirmOpen(false); 
        setManagerToResetPassword(null);
    }
  };

  if (isLoading && currentAdminCompanyId) {
    return <PageHeader title="Manage Managers" description="Loading manager data for your company..." icon={UserCog} />;
  }
  
  if (!currentAdminCompanyId && !isLoading) {
    return (
        <PageHeader title="Manage Managers" description="Company ID not found. Please ensure you are logged in correctly as an Admin." icon={UserCog}>
            <Card className="mt-4">
                <CardContent className="pt-6">
                    <p className="text-destructive text-center">Could not retrieve your company information. Please try logging out and back in.</p>
                </CardContent>
            </Card>
        </PageHeader>
    );
  }


  return (
    <>
      <PageHeader
        title="Manage Managers"
        description="Administer Store Manager accounts for your company."
        icon={UserCog}
        actions={
          <Button onClick={() => { form.reset(); setIsAddManagerDialogOpen(true); }} className="mt-4 sm:mt-0" disabled={!currentAdminCompanyId}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Manager
          </Button>
        }
      />

      <Dialog open={isAddManagerDialogOpen} onOpenChange={(isOpen) => {
          setIsAddManagerDialogOpen(isOpen);
          if (!isOpen) form.reset(); 
        }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Store Manager</DialogTitle>
            <DialogDescription>
              Fill in the details to create a new Store Manager account for your company. The email will be their login ID.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddManagerSubmit)} className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Sunil Varma" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Login ID)</FormLabel>
                    <FormControl><Input type="email" placeholder="e.g., manager.sunil@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Password</FormLabel>
                    <FormControl><Input type="password" placeholder="Set an initial password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 border-t -mx-6 px-6 flex flex-col sm:flex-row gap-2">
                <DialogClose asChild><Button type="button" variant="outline" className="w-full sm:w-auto">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
                  {form.formState.isSubmitting ? "Adding Manager..." : "Add Manager"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isToggleStatusConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setManagerToToggleStatus(null); setIsToggleStatusConfirmOpen(isOpen);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Account Status Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {managerToToggleStatus?.status === "Active" ? "freeze" : "unfreeze"} the account for {managerToToggleStatus?.name}?
              {managerToToggleStatus?.status === "Active" 
                ? " Freezing will change their application status, potentially limiting access."
                : " Unfreezing will restore their active application status."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setIsToggleStatusConfirmOpen(false); setManagerToToggleStatus(null);}}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleStatus} className={managerToToggleStatus?.status === "Active" ? "bg-destructive hover:bg-destructive/90" : "bg-green-600 hover:bg-green-700"}>
              {managerToToggleStatus?.status === "Active" ? "Freeze Account" : "Unfreeze Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isResetPasswordConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setManagerToResetPassword(null); setIsResetPasswordConfirmOpen(isOpen);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Password Reset</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a password reset link to {managerToResetPassword?.name} ({managerToResetPassword?.email}). They can use this link to set a new password. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setIsResetPasswordConfirmOpen(false); setManagerToResetPassword(null);}}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetPassword}>
              Send Reset Email
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Your Company's Manager List</CardTitle>
          <CardDescription>A list of all store managers for your company and their account status from Firestore.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && managers.length === 0 && currentAdminCompanyId ? (
            <div className="text-center py-10 text-muted-foreground">Loading managers...</div>
          ) : !isLoading && managers.length === 0 && currentAdminCompanyId ? ( 
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <UsersIcon className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
                <p className="text-lg sm:text-xl font-semibold text-muted-foreground">No Managers Found For Your Company</p>
                <p className="text-xs sm:text-sm text-muted-foreground mb-6">Create manager accounts to grant access to store operations for your company.</p>
                <Button onClick={() => { form.reset(); setIsAddManagerDialogOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add New Manager
                </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Email (Login ID)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managers.map((manager) => (
                  <TableRow key={manager.id}>
                    <TableCell className="font-medium">{manager.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{manager.email}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={manager.status === "Active" ? "default" : "destructive"} className={manager.status === "Active" ? "bg-accent text-accent-foreground" : ""}>
                        {manager.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions for {manager.name}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openToggleStatusDialog(manager)}>
                            {manager.status === "Active" ? (
                              <><ShieldAlert className="mr-2 h-4 w-4" /> Freeze Account</>
                            ) : (
                              <><ShieldCheck className="mr-2 h-4 w-4" /> Unfreeze Account</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openResetPasswordDialog(manager)}>
                            <KeyRound className="mr-2 h-4 w-4" /> Send Password Reset
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
    