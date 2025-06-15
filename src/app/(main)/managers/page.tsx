
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { UserCog, PlusCircle, MoreHorizontal, ShieldAlert, ShieldCheck, KeyRound } from "lucide-react"; // Removed Trash2
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
// Future: Import Firebase functions for creating users, updating status, etc.
// import { createUserWithEmailAndPassword } from 'firebase/auth';
// import { auth, db } from '@/lib/firebase/firebaseConfig';
// import { doc, setDoc, getDocs, collection, updateDoc } from 'firebase/firestore';

/**
 * @fileOverview Page for Admin to manage Store Manager accounts.
 * Allows Admin to:
 * - View a list of all managers.
 * - Add new managers (creating their login credentials).
 * - Freeze/Unfreeze manager accounts (preventing/allowing login).
 * - Reset passwords for managers (placeholder functionality).
 * Manager accounts are never permanently deleted to preserve historical data.
 */

interface Manager {
  id: string; // Firestore document ID or unique local ID
  name: string;
  email: string; // Used as User ID for login
  status: "Active" | "Frozen";
  // Future: Add other relevant fields like dateCreated, lastLogin, etc.
}

// Initial dummy data. This will be replaced by Firestore data in Phase 2.
const initialManagers: Manager[] = [
  { id: "MGR001", name: "Sunita Sharma", email: "manager@example.com", status: "Active" },
  { id: "MGR002", name: "Rajesh Kumar", email: "manager2@example.com", status: "Active" },
  { id: "MGR003", name: "Priya Singh", email: "manager3@example.com", status: "Frozen" },
];

// Zod schema for the add manager form
const managerSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  email: z.string().email({ message: "Invalid email address. This will be their login ID."}),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type ManagerFormValues = z.infer<typeof managerSchema>;

/**
 * ManageManagersPage component.
 * Provides UI and logic for Admin to manage Store Manager accounts.
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
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  // Effect to load managers (currently from initial data, future from Firestore)
  useEffect(() => {
    // Future: Fetch managers from Firestore
    // const fetchManagers = async () => {
    //   setIsLoading(true);
    //   try {
    //     const querySnapshot = await getDocs(collection(db, "managers"));
    //     const fetchedManagers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Manager));
    //     setManagers(fetchedManagers);
    //   } catch (error) {
    //     console.error("Error fetching managers: ", error);
    //     toast({ title: "Error", description: "Could not load managers.", variant: "destructive" });
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    // fetchManagers();

    // Phase 1: Use local data
    setManagers(initialManagers);
    setIsLoading(false);
  }, [toast]);


  /**
   * Handles submission of the "Add New Manager" form.
   * Phase 1: Adds to local state.
   * Future: Creates user in Firebase Auth and manager profile in Firestore.
   */
  const handleAddManagerSubmit = async (values: ManagerFormValues) => {
    // Future: Firebase integration
    // try {
    //   // 1. Create user in Firebase Authentication (Admin SDK might be needed for password setting directly, or send email link)
    //   // This example assumes client-side creation for simplicity, but for managers, admin creating them is better.
    //   // For true admin creation, this would be an API call to a backend function with Admin SDK.
    //   // const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
    //   // const newUserId = userCredential.user.uid;
    //   //
    //   // 2. Add manager profile to Firestore
    //   // const newManagerData = { name: values.name, email: values.email, status: "Active", authUid: newUserId };
    //   // await setDoc(doc(db, "managers", newUserId), newManagerData); // Use authUid as doc ID
    //   // setManagers((prev) => [{ id: newUserId, ...newManagerData }, ...prev]);

    //   toast({
    //     title: "Manager Added",
    //     description: `${values.name} has been added. Their temporary password is "${values.password}". They can now log in.`,
    //   });
    // } catch (error: any) {
    //   console.error("Error adding manager: ", error);
    //   // Handle specific Firebase errors, e.g., auth/email-already-in-use
    //   toast({ title: "Error", description: error.message || "Failed to add manager.", variant: "destructive" });
    //   return;
    // }

    // Phase 1: Local state update
    const newManager: Manager = {
      id: `MGR-LOCAL-${Date.now()}`, // Temporary local ID
      name: values.name,
      email: values.email,
      status: "Active",
    };
    setManagers((prev) => [newManager, ...prev]);
    toast({
      title: "Manager Added (Locally)",
      description: `${values.name} has been added with email ${values.email}. Password: ${values.password}.`,
    });

    form.reset();
    setIsAddManagerDialogOpen(false);
  };

  /**
   * Opens the confirmation dialog for toggling a manager's account status.
   */
  const openToggleStatusDialog = (manager: Manager) => {
    setManagerToToggleStatus(manager);
    setIsToggleStatusConfirmOpen(true);
  };

  /**
   * Handles toggling a manager's account status (Active/Frozen).
   * Phase 1: Updates local state.
   * Future: Updates status in Firestore. Freezing/Unfreezing does NOT affect Firebase Auth state directly,
   *         it's an application-level status. Login check would verify this Firestore status.
   */
  const confirmToggleStatus = async () => {
    if (!managerToToggleStatus) return;
    const newStatus = managerToToggleStatus.status === "Active" ? "Frozen" : "Active";

    // Future: Firebase integration
    // try {
    //   const managerRef = doc(db, "managers", managerToToggleStatus.id);
    //   await updateDoc(managerRef, { status: newStatus });
    //   setManagers((prev) =>
    //     prev.map((m) => (m.id === managerToToggleStatus.id ? { ...m, status: newStatus } : m))
    //   );
    //   toast({
    //     title: `Manager Account ${newStatus === "Active" ? "Activated" : "Frozen"}`,
    //     description: `${managerToToggleStatus.name}'s account is now ${newStatus.toLowerCase()}.`,
    //   });
    // } catch (error) {
    //   console.error("Error updating manager status: ", error);
    //   toast({ title: "Error", description: "Failed to update manager status.", variant: "destructive" });
    // }

    // Phase 1: Local state update
    setManagers((prev) =>
      prev.map((m) =>
        m.id === managerToToggleStatus.id ? { ...m, status: newStatus } : m
      )
    );
    toast({
      title: `Manager Account ${newStatus === "Active" ? "Activated" : "Frozen"} (Locally)`,
      description: `${managerToToggleStatus.name}'s account is now ${newStatus.toLowerCase()}.`,
    });

    setIsToggleStatusConfirmOpen(false);
    setManagerToToggleStatus(null);
  };

  /**
   * Opens the confirmation dialog for resetting a manager's password.
   */
  const openResetPasswordDialog = (manager: Manager) => {
    setManagerToResetPassword(manager);
    setIsResetPasswordConfirmOpen(true);
  };

  /**
   * Handles resetting a manager's password.
   * Placeholder: In a real app, this would trigger Firebase's sendPasswordResetEmail.
   */
  const confirmResetPassword = async () => {
    if (!managerToResetPassword) return;

    // Future: Firebase integration
    // try {
    //   await sendPasswordResetEmail(auth, managerToResetPassword.email);
    //   toast({
    //     title: "Password Reset Email Sent",
    //     description: `A password reset email has been sent to ${managerToResetPassword.email}.`,
    //   });
    // } catch (error: any) {
    //   console.error("Error sending password reset email: ", error);
    //   toast({ title: "Error", description: error.message || "Failed to send password reset email.", variant: "destructive" });
    // }

    // Phase 1: Placeholder action
    toast({
      title: "Password Reset Initiated (Simulated)",
      description: `If this were live, a password reset email would be sent to ${managerToResetPassword.email}.`,
    });

    setIsResetPasswordConfirmOpen(false);
    setManagerToResetPassword(null);
  };

  if (isLoading) {
    return <PageHeader title="Manage Managers" description="Loading manager data..." icon={UserCog} />;
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
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Sunil Varma" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Login ID)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., manager.sunil@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temporary Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Set a temporary password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
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
              Are you sure you want to initiate a password reset for {managerToResetPassword?.name} ({managerToResetPassword?.email})?
              In a live system, this would typically send them a password reset email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setIsResetPasswordConfirmOpen(false); setManagerToResetPassword(null);}}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetPassword}>
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Manager List</CardTitle>
          <CardDescription>A list of all store managers and their account status.</CardDescription>
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
                          {/* Manager accounts are not deleted to preserve history. */}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-md">
              <p className="text-muted-foreground">No managers found. Click "Add New Manager" to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
      {/* 
        Phase 1 Data Storage: Manager data is stored in local component state.
        Phase 2 (Future-Ready):
        - Manager data will be stored in a 'managers' collection in Firebase Firestore.
        - Each document ID in Firestore could be the Firebase Auth UID of the manager.
        - Fields would include: name, email, status ('Active', 'Frozen'), authUid, createdAt, etc.
        - Adding a manager would:
          1. Create an authentication record in Firebase Auth (likely via Admin SDK in a backend function for security).
          2. Create a corresponding document in the 'managers' Firestore collection.
        - Freezing/Unfreezing would update the 'status' field in the Firestore document.
        - Resetting password would use Firebase Auth's `sendPasswordResetEmail` function.
        - Manager login would check Firebase Auth and then verify the 'status' field in Firestore.
      */}
    </>
  );
}
