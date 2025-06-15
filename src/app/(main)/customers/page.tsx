
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Users, PlusCircle, MoreHorizontal, Edit, Trash2, Eye, CreditCard } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import { useRouter, useSearchParams } from 'next/navigation'; // Added useSearchParams


/**
 * @fileOverview Page for managing customer profiles.
 * Allows Admin to perform full CRUD operations on customers in Firestore.
 * Allows Store Manager to:
 *  - Create new customers.
 *  - View customer list.
 *  - View customer details, past transactions (placeholder).
 *  - Update payment status of customer bills (placeholder).
 * Store Managers cannot delete customers. Data is managed in Firebase Firestore.
 */

/**
 * Interface representing a Customer document in Firestore.
 */
export interface Customer {
  id: string; // Firestore document ID
  name: string;
  email: string; // Optional email
  phone: string;
  gstin?: string; // Optional GSTIN
  totalSpent: string; // Display string, e.g., "₹10,000.00" - Placeholder, calculated or updated separately
  address?: string; // Optional address
  createdAt?: Timestamp; // Firestore Timestamp of creation
}

// Zod schema for customer form validation
const customerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }).regex(/^\d+[\d\s-]*$/, { message: "Phone number must contain valid characters (digits, spaces, hyphens)."}),
  gstin: z.string().optional().or(z.literal('')),
  address: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

/**
 * Retrieves a cookie value by name.
 * Used here to determine the current user's role for access control.
 * @param {string} name - The name of the cookie.
 * @returns {string | undefined} The cookie value or undefined if not found.
 */
const getCookie = (name: string): string | undefined => {
  if (typeof window === 'undefined') return undefined; // Ensure running in browser
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

/**
 * CustomersPage component.
 * Provides UI and logic for managing customer data in Firestore.
 * Handles CRUD operations, dialogs for add/edit, and role-based action availability.
 * @returns {JSX.Element} The rendered customers page.
 */
export default function CustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams(); // For query parameters like `addNew`

  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);
  const [isEditCustomerDialogOpen, setIsEditCustomerDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>(undefined);

  const { toast } = useToast();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", email: "", phone: "", gstin: "", address: "" },
  });

  /**
   * Fetches customer list from Firestore, ordered by name.
   */
  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "customers"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedCustomers = querySnapshot.docs.map(docSnapshot => {
          const data = docSnapshot.data();
          return { 
              id: docSnapshot.id,
              name: data.name,
              email: data.email || "", // Ensure email is not undefined
              phone: data.phone,
              gstin: data.gstin || "",
              address: data.address || "",
              totalSpent: data.totalSpent || "₹0.00", // Placeholder until calculated dynamically
              createdAt: data.createdAt,
          } as Customer;
      });
      setCustomerList(fetchedCustomers);
    } catch (error) {
      console.error("Error fetching customers: ", error);
      toast({ title: "Database Error", description: "Could not load customers. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch current user role and customer list on component mount
  useEffect(() => {
    setCurrentUserRole(getCookie('userRole'));
    fetchCustomers();
  }, [fetchCustomers]);

  // If `addNew=true` is in URL params, open the add customer dialog
  useEffect(() => {
    if (searchParams.get('addNew') === 'true') {
      setIsAddCustomerDialogOpen(true);
      // Optional: Clear the query param after opening the dialog to avoid re-triggering
      // router.replace('/customers', { scroll: false }); 
    }
  }, [searchParams, router]);


  // Effect to reset form when editingCustomer or dialog state changes
  useEffect(() => {
    if (editingCustomer && isEditCustomerDialogOpen) {
      form.reset({
        name: editingCustomer.name,
        email: editingCustomer.email,
        phone: editingCustomer.phone,
        gstin: editingCustomer.gstin || "",
        address: editingCustomer.address || "",
      });
    } else if (isAddCustomerDialogOpen) { // Reset for add dialog as well
      form.reset({ name: "", email: "", phone: "", gstin: "", address: "" });
    }
  }, [editingCustomer, isEditCustomerDialogOpen, isAddCustomerDialogOpen, form]);

  /**
   * Handles submission of the "Add New Customer" form.
   * Saves new customer data to Firestore.
   * @param {CustomerFormValues} values - The validated form values.
   */
  const handleAddSubmit = async (values: CustomerFormValues) => {
    try {
      const newCustomerData = { 
        ...values, 
        email: values.email || "", // Ensure email is string, not undefined
        totalSpent: "₹0.00", // Initial value for total spent
        createdAt: serverTimestamp() // Firestore server-side timestamp
      };
      await addDoc(collection(db, "customers"), newCustomerData);
      toast({ title: "Customer Added", description: `${values.name} has been successfully added.` });
      fetchCustomers(); // Re-fetch to update the list
      form.reset();
      setIsAddCustomerDialogOpen(false);
    } catch (error) {
      console.error("Error adding customer: ", error);
      toast({ title: "Save Error", description: "Failed to add customer to the database.", variant: "destructive" });
    }
  };

  /**
   * Handles submission of the "Edit Customer" form.
   * Updates existing customer data in Firestore.
   * @param {CustomerFormValues} values - The validated form values.
   */
  const handleEditSubmit = async (values: CustomerFormValues) => {
    if (!editingCustomer) return; // Should not happen if dialog is open for edit
    try {
      const customerRef = doc(db, "customers", editingCustomer.id);
      const updatedData = { ...values, email: values.email || "" }; // Ensure email is string
      await updateDoc(customerRef, updatedData);
      toast({ title: "Customer Updated", description: `${values.name} has been successfully updated.` });
      fetchCustomers(); // Re-fetch to update the list
      setEditingCustomer(null);
      setIsEditCustomerDialogOpen(false);
      form.reset();
    } catch (error) {
      console.error("Error updating customer: ", error);
      toast({ title: "Update Error", description: "Failed to update customer in the database.", variant: "destructive" });
    }
  };
  
  /**
   * Opens the edit customer dialog and pre-fills form with customer data.
   * @param {Customer} customer - The customer object to edit.
   */
  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsEditCustomerDialogOpen(true);
  };

  /**
   * Opens the delete confirmation dialog for a customer.
   * Restricted to Admins.
   * @param {Customer} customer - The customer object to delete.
   */
  const openDeleteDialog = (customer: Customer) => {
    if (currentUserRole !== 'admin') { // Role check
      toast({ title: "Permission Denied", description: "Only Admins can delete customers.", variant: "destructive"});
      return;
    }
    setCustomerToDelete(customer);
    setIsDeleteConfirmOpen(true);
  };

  /**
   * Confirms and executes deletion of a customer from Firestore.
   * Restricted to Admins.
   */
  const confirmDelete = async () => {
    if (!customerToDelete || currentUserRole !== 'admin') return;
    try {
      await deleteDoc(doc(db, "customers", customerToDelete.id));
      toast({ title: "Customer Deleted", description: `${customerToDelete.name} has been successfully deleted.`, variant: "default" });
      fetchCustomers(); // Re-fetch to update the list
      setCustomerToDelete(null);
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      console.error("Error deleting customer: ", error);
      toast({ title: "Deletion Error", description: "Failed to delete customer from the database.", variant: "destructive" });
    }
  };

  /**
   * Placeholder for viewing detailed customer history.
   * @param {Customer} customer - The customer whose details to view.
   */
  const handleViewDetails = (customer: Customer) => {
    toast({ title: "View Details (Placeholder)", description: `Viewing details for ${customer.name}. Purchase/payment history page to be implemented.`});
    // Future: router.push(`/customers/${customer.id}`);
  };

  /**
   * Placeholder for updating payment status related to a customer.
   * @param {Customer} customer - The customer involved.
   */
  const handleUpdatePaymentStatus = (customer: Customer) => {
    toast({ title: "Update Payment Status (Placeholder)", description: `Functionality to update payment status for ${customer.name}'s bills to be implemented.`});
    // Future: This would likely involve selecting a specific bill and then updating its status in Firestore.
  };

  // Render loading state if data is being fetched
  if (isLoading) {
    return <PageHeader title="Manage Customers" description="Loading customer data from database..." icon={Users} />;
  }

  return (
    <>
      <PageHeader
        title="Manage Customers"
        description="View, add, edit customer profiles. Admins can also delete."
        icon={Users}
        actions={
          <Button onClick={() => { form.reset(); setIsAddCustomerDialogOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Customer
          </Button>
        }
      />

      {/* Add/Edit Customer Dialog (uses a shared form structure) */}
      <Dialog 
        open={isAddCustomerDialogOpen || isEditCustomerDialogOpen} 
        onOpenChange={(isOpen) => {
          if (!isOpen) { // When dialog is closed
            setIsAddCustomerDialogOpen(false);
            setIsEditCustomerDialogOpen(false);
            setEditingCustomer(null);
            form.reset(); // Reset form on close
            // Optional: Remove query param if it was used to open dialog
            if (searchParams.get('addNew') === 'true') {
                 router.replace('/customers', { scroll: false });
            }
          } else { // When dialog is opened
            if (editingCustomer) setIsEditCustomerDialogOpen(true);
            else setIsAddCustomerDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
            <DialogDescription>
              {editingCustomer ? `Update details for "${editingCustomer.name}".` : "Fill in the details to add a new customer."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            {/* Form submission calls either handleEditSubmit or handleAddSubmit */}
            <form onSubmit={form.handleSubmit(editingCustomer ? handleEditSubmit : handleAddSubmit)} className="space-y-4 py-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Priya Sharma" {...field} /></FormControl>
                    <FormMessage /> {/* Displays validation errors */}
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl><Input type="email" placeholder="e.g., priya@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input placeholder="e.g., 9876543210" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="gstin" render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., 29AABCU9517R1Z5" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., 123 Main St, Bangalore" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                {/* DialogClose wraps the Cancel button to handle closing */}
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit">{editingCustomer ? "Save Changes" : "Add Customer"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog (Admin Only) */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setCustomerToDelete(null); setIsDeleteConfirmOpen(isOpen);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the customer &quot;{customerToDelete?.name}&quot; from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setIsDeleteConfirmOpen(false); setCustomerToDelete(null);}}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90" disabled={currentUserRole !== 'admin'}>
              Delete Customer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer List Table */}
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Customer List</CardTitle>
          <CardDescription>A list of all registered customers from Firestore, ordered alphabetically.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerList.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.email || "N/A"}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.gstin || "N/A"}</TableCell>
                  <TableCell className="text-right">{customer.totalSpent}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions for {customer.name}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(customer)}>
                            <Eye className="mr-2 h-4 w-4" /> View Details & History
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(customer)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Customer
                        </DropdownMenuItem>
                        {/* Actions available to Store Manager and Admin */}
                        {(currentUserRole === 'store_manager' || currentUserRole === 'admin') && (
                            <DropdownMenuItem onClick={() => handleUpdatePaymentStatus(customer)}>
                                <CreditCard className="mr-2 h-4 w-4" /> Update Payment Status
                            </DropdownMenuItem>
                        )}
                        {/* Delete action only for Admin */}
                        {currentUserRole === 'admin' && (
                          <DropdownMenuItem onClick={() => openDeleteDialog(customer)} className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Customer
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           {customerList.length === 0 && !isLoading && ( // Message if no customers are found
             <div className="text-center py-8 text-muted-foreground">
                No customers found in the database. Click "Add New Customer" to get started.
             </div>
           )}
        </CardContent>
      </Card>
    </>
  );
}

