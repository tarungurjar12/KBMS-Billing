
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
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '@/lib/firebase/firebaseConfig';
import { doc, setDoc, getDocs, collection, updateDoc, serverTimestamp, query, orderBy, Timestamp, where } from 'firebase/firestore'; // Added 'where'

/**
 * @fileOverview Page for Admin to manage Store Manager accounts.
 * Allows Admin to:
 * - View a list of all managers from the 'users' collection in Firestore (filtered by role 'store_manager').
 * - Add new managers (creating their login credentials in Firebase Auth and profile in Firestore).
 * - Freeze/Unfreeze manager accounts (updates 'status' field in Firestore).
 * - Reset passwords for managers (using Firebase Auth's password reset email functionality).
 * Manager accounts are 'Frozen' rather than deleted to preserve historical data.
 */

/**
 * Interface representing a Store Manager document in Firestore.
 * This is typically stored in a 'users' collection with a 'role' field.
 */
export interface Manager {
  id: string; // Firestore document ID (should be the same as Firebase Auth UID)
  name: string;
  email: string; // Used as User ID for login
  status: "Active" | "Frozen"; // Application-level status
  authUid: string; // Firebase Auth UID
  role: "store_manager"; // Explicit role field
  createdAt?: Timestamp; // Firestore Timestamp of creation
}

// Zod schema for the "Add New Manager" form validation
const managerSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  email: z.string().email({ message: "Invalid email address. This will be their login ID."}),
  password: z.string().min(6, { message: "Password must be at least 6 characters for security." }),
});

type ManagerFormValues = z.infer<typeof managerSchema>;

/**
 * ManageManagersPage component.
 * Provides UI and logic for Admin to manage Store Manager accounts using Firebase Auth and Firestore.
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
   * Fetches the list of store managers from Firestore.
   * Filters users by role 'store_manager' and orders them by name.
   */
  const fetchManagers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Query the 'users' collection, filtering for documents where role is 'store_manager'
      const q = query(collection(db, "users"), where("role", "==", "store_manager"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedManagers = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id, // Firestore document ID
          name: data.name,
          email: data.email,
          status: data.status || "Active", // Default to Active if status is missing
          authUid: data.authUid, // This should be the Firebase Auth UID
          role: data.role, // Should be 'store_manager'
          createdAt: data.createdAt,
        } as Manager;
      });
      setManagers(fetchedManagers);
    } catch (error) {
      console.error("Error fetching managers: ", error);
      toast({ title: "Database Error", description: "Could not load managers from the database. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch managers when the component mounts
  useEffect(() => {
    fetchManagers();
  }, [fetchManagers]);


  /**
   * Handles submission of the "Add New Manager" form.
   * 1. Creates a new user in Firebase Authentication.
   * 2. Creates a corresponding manager profile in Firestore's 'users' collection,
   *    using the Firebase Auth UID as the document ID and setting role to 'store_manager'.
   * @param {ManagerFormValues} values - The validated form values.
   */
  const handleAddManagerSubmit = async (values: ManagerFormValues) => {
    try {
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const newUserId = userCredential.user.uid; // This is the Firebase Auth UID
      
      // Prepare manager data for Firestore
      const newManagerData: Omit<Manager, 'id' | 'createdAt'> & {createdAt: any} = { 
        name: values.name, 
        email: values.email, 
        status: "Active", // Default status
        authUid: newUserId, // Store the Auth UID
        role: "store_manager", // Explicitly set role
        createdAt: serverTimestamp() // Firestore server-side timestamp
      };
      
      // Create manager document in Firestore 'users' collection, using authUid as the document ID
      await setDoc(doc(db, "users", newUserId), newManagerData); 
      
      toast({
        title: "Manager Added Successfully",
        description: `${values.name} can now log in. A password reset might be needed for them to set their own password if this was temporary.`,
      });
      fetchManagers(); // Refresh manager list
      form.reset(); // Reset form fields
      setIsAddManagerDialogOpen(false); // Close the dialog
    } catch (error: any) {
      console.error("Error adding manager: ", error);
      let errorMessage = "Failed to add manager. Please check the details and try again.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email address is already registered. Please use a different email.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The password is too weak. Please use a stronger password (at least 6 characters).";
      }
      toast({ title: "Adding Manager Failed", description: errorMessage, variant: "destructive" });
    }
  };

  /**
   * Opens the confirmation dialog for toggling a manager's account status.
   * @param {Manager} manager - The manager whose status is to be toggled.
   */
  const openToggleStatusDialog = (manager: Manager) => {
    setManagerToToggleStatus(manager);
    setIsToggleStatusConfirmOpen(true);
  };

  /**
   * Toggles a manager's account status (Active/Frozen) in their Firestore document.
   * 'Frozen' status typically means the user cannot perform actions within the application,
   * though their Firebase Auth account remains active unless disabled separately in Firebase Console.
   */
  const confirmToggleStatus = async () => {
    if (!managerToToggleStatus) return;
    const newStatus = managerToToggleStatus.status === "Active" ? "Frozen" : "Active";
    try {
      const managerRef = doc(db, "users", managerToToggleStatus.authUid); // Use authUid to reference the document
      await updateDoc(managerRef, { status: newStatus });
      toast({
        title: `Manager Account ${newStatus === "Active" ? "Activated" : "Frozen"}`,
        description: `${managerToToggleStatus.name}'s account status is now ${newStatus.toLowerCase()}.`,
      });
      fetchManagers(); // Refresh list to reflect the change
    } catch (error) {
      console.error("Error updating manager status: ", error);
      toast({ title: "Status Update Error", description: "Failed to update manager status in the database.", variant: "destructive" });
    } finally {
        setIsToggleStatusConfirmOpen(false); // Close confirmation dialog
        setManagerToToggleStatus(null);
    }
  };

  /**
   * Opens the confirmation dialog for sending a password reset email.
   * @param {Manager} manager - The manager for whom to reset the password.
   */
  const openResetPasswordDialog = (manager: Manager) => {
    setManagerToResetPassword(manager);
    setIsResetPasswordConfirmOpen(true);
  };

  /**
   * Sends a password reset email to the manager using Firebase Authentication.
   */
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
        setIsResetPasswordConfirmOpen(false); // Close confirmation dialog
        setManagerToResetPassword(null);
    }
  };

  // Display loading state while fetching managers
  if (isLoading) {
    return <PageHeader title="Manage Managers" description="Loading manager data from database..." icon={UserCog} />;
  }

  return (
    <>
      <PageHeader
        title="Manage Managers"
        description="Administer Store Manager accounts, permissions, and status."
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
          if (!isOpen) form.reset(); // Reset form when dialog closes
        }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add New Store Manager</DialogTitle>
            <DialogDescription>
              Fill in the details to create a new Store Manager account. The email will be their login ID.
              The manager will receive instructions to set their password if this is temporary.
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
                    <FormLabel>Initial Password</FormLabel>
                    <FormControl><Input type="password" placeholder="Set an initial password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Adding Manager..." : "Add Manager"}
                </Button>
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
                ? " Freezing will change their application status, potentially limiting access."
                : " Unfreezing will restore their active application status."}
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

      {/* Manager List Table */}
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
                            <KeyRound className="mr-2 h-4 w-4" /> Send Password Reset
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : ( // Display message if no managers are found
            <div className="text-center py-8 text-muted-foreground">
                No managers found in the database. Click "Add New Manager" to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

