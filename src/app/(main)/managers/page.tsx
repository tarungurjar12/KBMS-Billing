
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { UserCog, PlusCircle, MoreHorizontal, ShieldAlert, ShieldCheck, KeyRound } from "lucide-react";
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
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'; // Firebase auth functions for user creation
import { auth, db } from '@/lib/firebase/firebaseConfig'; // Firebase auth and db instances
import { doc, setDoc, getDocs, collection, updateDoc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore'; // Firestore functions

/**
 * @fileOverview Page for Admin to manage Store Manager accounts.
 * Allows Admin to:
 * - View a list of all managers from Firestore.
 * - Add new managers (creating their login credentials in Firebase Auth and profile in Firestore).
 * - Freeze/Unfreeze manager accounts (application-level status in Firestore).
 * - Reset passwords for managers (using Firebase Auth).
 * Manager accounts are never permanently deleted from Firestore to preserve historical data, only 'Frozen'.
 * Their Firebase Auth account can be disabled/deleted separately if needed, but this UI focuses on application status.
 */

export interface Manager {
  id: string; // Firestore document ID (should be Firebase Auth UID)
  name: string;
  email: string; // Used as User ID for login
  status: "Active" | "Frozen";
  authUid: string; // Firebase Auth UID
  createdAt?: Timestamp; // Firestore Timestamp
  // Future: lastLogin, role ('store_manager' explicitly)
}

// Zod schema for the add manager form
const managerSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  email: z.string().email({ message: "Invalid email address. This will be their login ID."}),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type ManagerFormValues = z.infer<typeof managerSchema>;

/**
 * ManageManagersPage component.
 * Provides UI and logic for Admin to manage Store Manager accounts using Firebase.
 * @returns {JSX.Element} The rendered manage managers page.
 */
export default function ManageManagersPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddManagerDialogOpen, setIsAddManagerDialogOpen] = useState(false);
  const [managerToToggleStatus, setManagerToToggleStatus] = useState<Manager | null>(null);
  const [isToggleStatusConfirmOpen, setIsToggleStatusConfirmOpen] = useState(false);
  const [managerToResetPassword, setManagerToResetPassword] = useState<Manager | null>(null);
  const [isResetPasswordConfirmOpen, setIsResetPasswordConfirmOpen] = useState(false);

  const { toast } = useToast();

  const form = useForm<ManagerFormValues>({
    resolver: zodResolver(managerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  /**
   * Fetches manager list from Firestore.
   */
  const fetchManagers = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "users"), where("role", "==", "store_manager"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedManagers = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id, // Firestore doc ID (which should be Auth UID)
          name: data.name,
          email: data.email,
          status: data.status || "Active", // Default to Active if status is missing
          authUid: data.authUid,
          createdAt: data.createdAt,
        } as Manager;
      });
      setManagers(fetchedManagers);
    } catch (error) {
      console.error("Error fetching managers: ", error);
      toast({ title: "Error", description: "Could not load managers from database.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);


  /**
   * Handles submission of the "Add New Manager" form.
   * Creates user in Firebase Auth and manager profile in Firestore 'users' collection with role 'store_manager'.
   */
  const handleAddManagerSubmit = async (values: ManagerFormValues) => {
    // Note: Creating users client-side like this is generally okay for admin panels,
    // but for higher security, this could be a call to a Firebase Cloud Function with Admin SDK.
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const newUserId = userCredential.user.uid;
      
      const newManagerData = { 
        name: values.name, 
        email: values.email, 
        status: "Active", 
        authUid: newUserId,
        role: "store_manager", // Explicitly set role
        createdAt: serverTimestamp()
      };
      
      await setDoc(doc(db, "users", newUserId), newManagerData); // Use authUid as doc ID in 'users' collection
      
      toast({
        title: "Manager Added",
        description: `${values.name} has been added. They can now log in with the provided credentials.`,
      });
      fetchManagers(); // Refresh manager list
      form.reset();
      setIsAddManagerDialogOpen(false);
    } catch (error: any) {
      console.error("Error adding manager: ", error);
      let errorMessage = "Failed to add manager.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email is already registered. Please use a different email.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The password is too weak. Please use a stronger password.";
      }
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const openToggleStatusDialog = (manager: Manager) => {
    setManagerToToggleStatus(manager);
    setIsToggleStatusConfirmOpen(true);
  };

  /**
   * Toggles a manager's account status (Active/Frozen) in Firestore.
   */
  const confirmToggleStatus = async () => {
    if (!managerToToggleStatus) return;
    const newStatus = managerToToggleStatus.status === "Active" ? "Frozen" : "Active";
    try {
      const managerRef = doc(db, "users", managerToToggleStatus.authUid); // Use authUid as ID
      await updateDoc(managerRef, { status: newStatus });
      toast({
        title: `Manager Account ${newStatus === "Active" ? "Activated" : "Frozen"}`,
        description: `${managerToToggleStatus.name}'s account is now ${newStatus.toLowerCase()}.`,
      });
      fetchManagers(); // Refresh list
    } catch (error) {
      console.error("Error updating manager status: ", error);
      toast({ title: "Error", description: "Failed to update manager status in database.", variant: "destructive" });
    } finally {
        setIsToggleStatusConfirmOpen(false);
        setManagerToToggleStatus(null);
    }
  };

  const openResetPasswordDialog = (manager: Manager) => {
    setManagerToResetPassword(manager);
    setIsResetPasswordConfirmOpen(true);
  };

  /**
   * Sends a password reset email using Firebase Auth.
   */
  const confirmResetPassword = async () => {
    if (!managerToResetPassword) return;
    try {
      await sendPasswordResetEmail(auth, managerToResetPassword.email);
      toast({
        title: "Password Reset Email Sent",
        description: `A password reset email has been sent to ${managerToResetPassword.email}.`,
      });
    } catch (error: any) {
      console.error("Error sending password reset email: ", error);
      toast({ title: "Error", description: error.message || "Failed to send password reset email.", variant: "destructive" });
    } finally {
        setIsResetPasswordConfirmOpen(false);
        setManagerToResetPassword(null);
    }
  };

  if (isLoading) {
    return <PageHeader title="Manage Managers" description="Loading manager data from database..." icon={UserCog} />;
  }

  return (
    <>
      <PageHeader
        title="Manage Managers"
        description="Administer Store Manager accounts and permissions."
        icon={UserCog}
        actions={
          <Button onClick={() => { form.reset(); setIsAddManagerDialogOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Manager
          </Button>
        }
      />

      {/* Add Manager Dialog */}
      <Dialog open={isAddManagerDialogOpen} onOpenChange={(isOpen) => {
          setIsAddManagerDialogOpen(isOpen);
          if (!isOpen) form.reset();
        }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add New Store Manager</DialogTitle>
            <DialogDescription>
              Fill in the details to create a new Store Manager account. The email will be their login ID.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddManagerSubmit)} className="space-y-4 py-2">
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
                    <FormLabel>Temporary Password</FormLabel>
                    <FormControl><Input type="password" placeholder="Set a temporary password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit">Add Manager</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Confirm Toggle Status Dialog */}
      <AlertDialog open={isToggleStatusConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setManagerToToggleStatus(null); setIsToggleStatusConfirmOpen(isOpen);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Account Status Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {managerToToggleStatus?.status === "Active" ? "freeze" : "unfreeze"} the account for {managerToToggleStatus?.name}?
              {managerToToggleStatus?.status === "Active" 
                ? " Freezing will prevent them from logging in (application-level check)."
                : " Unfreezing will allow them to log in again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setIsToggleStatusConfirmOpen(false); setManagerToToggleStatus(null);}}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleStatus} className={managerToToggleStatus?.status === "Active" ? "bg-destructive hover:bg-destructive/90" : ""}>
              {managerToToggleStatus?.status === "Active" ? "Freeze Account" : "Unfreeze Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Reset Password Dialog */}
      <AlertDialog open={isResetPasswordConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setManagerToResetPassword(null); setIsResetPasswordConfirmOpen(isOpen);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Password Reset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send a password reset email to {managerToResetPassword?.name} ({managerToResetPassword?.email})?
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
          <CardTitle className="font-headline text-foreground">Manager List</CardTitle>
          <CardDescription>A list of all store managers and their account status from Firestore.</CardDescription>
        </CardHeader>
        <CardContent>
          {managers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email (Login ID)</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managers.map((manager) => (
                  <TableRow key={manager.id}>
                    <TableCell className="font-medium">{manager.name}</TableCell>
                    <TableCell>{manager.email}</TableCell>
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
                            <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
                No managers found in the database. Click "Add New Manager" to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
