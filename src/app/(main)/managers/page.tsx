
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { UserCog, PlusCircle, MoreHorizontal, ShieldAlert, ShieldCheck, KeyRound, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Manager {
  id: string;
  name: string;
  userId: string;
  status: "Active" | "Frozen";
}

const initialManagers: Manager[] = [
  { id: "MGR001", name: "Sunita Sharma", userId: "manager", status: "Active" },
  { id: "MGR002", name: "Rajesh Kumar", userId: "manager2", status: "Active" },
  { id: "MGR003", name: "Priya Singh", userId: "manager3", status: "Frozen" },
];

const managerSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  userId: z.string().min(3, { message: "User ID must be at least 3 characters." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type ManagerFormValues = z.infer<typeof managerSchema>;

export default function ManageManagersPage() {
  const [managers, setManagers] = useState<Manager[]>(initialManagers);
  const [isAddManagerDialogOpen, setIsAddManagerDialogOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<Manager | null>(null); // For future edit functionality
  const [managerToToggleStatus, setManagerToToggleStatus] = useState<Manager | null>(null);
  const [managerToResetPassword, setManagerToResetPassword] = useState<Manager | null>(null);

  const { toast } = useToast();

  const form = useForm<ManagerFormValues>({
    resolver: zodResolver(managerSchema),
    defaultValues: {
      name: "",
      userId: "",
      password: "",
    },
  });

  // Placeholder for fetching managers from a data source
  // useEffect(() => {
  //   // async function fetchManagers() {
  //   //   // const fetchedManagers = await db.getManagers(); // Future cloud integration
  //   //   // setManagers(fetchedManagers);
  //   // }
  //   // fetchManagers();
  //   // For now, using initialManagers
  //   setManagers(initialManagers); 
  // }, []);


  const handleAddManagerSubmit = (values: ManagerFormValues) => {
    // In a real app, this would also involve secure password handling and backend API calls
    // For future cloud integration:
    // try {
    //   const newManagerData = { name: values.name, userId: values.userId, password: values.password };
    //   const createdManager = await api.createManager(newManagerData); // Example API call
    //   setManagers((prev) => [createdManager, ...prev]);
    // } catch (error) {
    //   toast({ title: "Error", description: "Failed to add manager.", variant: "destructive" });
    //   return;
    // }

    const newManager: Manager = {
      id: `MGR-${Date.now()}`,
      name: values.name,
      userId: values.userId,
      status: "Active",
    };
    setManagers((prev) => [newManager, ...prev]);
    toast({
      title: "Manager Added",
      description: `${values.name} has been successfully added. Their temporary password is "${values.password}".`,
    });
    form.reset();
    setIsAddManagerDialogOpen(false);
  };

  const handleToggleStatus = () => {
    if (!managerToToggleStatus) return;

    // For future cloud integration:
    // try {
    //   const newStatus = managerToToggleStatus.status === "Active" ? "Frozen" : "Active";
    //   await api.updateManagerStatus(managerToToggleStatus.id, newStatus); // Example API call
    //   setManagers((prev) =>
    //     prev.map((m) =>
    //       m.id === managerToToggleStatus.id ? { ...m, status: newStatus } : m
    //     )
    //   );
    // } catch (error) {
    //   toast({ title: "Error", description: "Failed to update manager status.", variant: "destructive" });
    //   return;
    // }
    
    setManagers((prev) =>
      prev.map((m) =>
        m.id === managerToToggleStatus.id
          ? { ...m, status: m.status === "Active" ? "Frozen" : "Active" }
          : m
      )
    );
    toast({
      title: `Manager ${managerToToggleStatus.status === "Active" ? "Frozen" : "Activated"}`,
      description: `${managerToToggleStatus.name}'s account is now ${managerToToggleStatus.status === "Active" ? "Frozen" : "Active"}.`,
    });
    setManagerToToggleStatus(null);
  };

  const handleResetPassword = () => {
    if (!managerToResetPassword) return;
    // In a real app, generate a secure temporary password and ideally email it or display securely.
    // For future cloud integration:
    // try {
    //   const newTempPassword = await api.resetManagerPassword(managerToResetPassword.id); // Example API call
    //   toast({
    //     title: "Password Reset",
    //     description: `Password for ${managerToResetPassword.name} has been reset. New temporary password: ${newTempPassword}`,
    //   });
    // } catch (error) {
    //   toast({ title: "Error", description: "Failed to reset password.", variant: "destructive" });
    //   return;
    // }
    
    const tempPassword = Math.random().toString(36).slice(-8); // Example temporary password
    toast({
      title: "Password Reset Initiated",
      description: `Password for ${managerToResetPassword.name} reset. (Simulated: New password is ${tempPassword})`,
    });
    setManagerToResetPassword(null);
  };

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
              Fill in the details to create a new Store Manager account.
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
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User ID (for login)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., sunilv" {...field} />
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
      <AlertDialog open={!!managerToToggleStatus} onOpenChange={() => setManagerToToggleStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Account Status Change</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {managerToToggleStatus?.status === "Active" ? "freeze" : "unfreeze"} the account for {managerToToggleStatus?.name}?
              {managerToToggleStatus?.status === "Active" 
                ? " Freezing will prevent them from logging in."
                : " Unfreezing will allow them to log in again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setManagerToToggleStatus(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleStatus} className={managerToToggleStatus?.status === "Active" ? "bg-destructive hover:bg-destructive/90" : ""}>
              {managerToToggleStatus?.status === "Active" ? "Freeze Account" : "Unfreeze Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Reset Password Dialog */}
      <AlertDialog open={!!managerToResetPassword} onOpenChange={() => setManagerToResetPassword(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Password Reset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset the password for {managerToResetPassword?.name}? A new temporary password will be generated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setManagerToResetPassword(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword}>
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
                  <TableHead>User ID</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managers.map((manager) => (
                  <TableRow key={manager.id}>
                    <TableCell className="font-medium">{manager.name}</TableCell>
                    <TableCell>{manager.userId}</TableCell>
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
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setManagerToToggleStatus(manager)}>
                            {manager.status === "Active" ? (
                              <><ShieldAlert className="mr-2 h-4 w-4" /> Freeze Account</>
                            ) : (
                              <><ShieldCheck className="mr-2 h-4 w-4" /> Unfreeze Account</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setManagerToResetPassword(manager)}>
                            <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                          </DropdownMenuItem>
                          {/* <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Manager (Not allowed per req.)
                          </DropdownMenuItem> */}
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
      {/* Comment for future data persistence:
          The 'managers' state is currently managed locally.
          In a production environment with cloud integration (e.g., Firebase Firestore):
          - Managers would be fetched from the database in useEffect.
          - Add, update (status, password reset) operations would call API endpoints 
            that interact with the cloud database.
          - Example: `await firestore.collection('managers').add(newManagerData);`
          - Example: `await firestore.collection('managers').doc(managerId).update({ status: newStatus });`
      */}
    </>
  );
}

    