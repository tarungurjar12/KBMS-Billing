
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

/**
 * @fileOverview Page for managing customer profiles.
 * Allows Admin to perform full CRUD operations on customers.
 * Allows Store Manager to:
 *  - Create new customers.
 *  - View customer list.
 *  - View customer details, past transactions (placeholder).
 *  - Update payment status of customer bills (placeholder).
 * Store Managers cannot delete customers. Data is managed in Firestore.
 */

export interface Customer {
  id: string; // Firestore document ID
  name: string;
  email: string; // Should be optional
  phone: string;
  gstin?: string; // Optional GSTIN
  totalSpent: string; // Display string, e.g., "₹10,000.00" - Placeholder for now, complex to calculate dynamically
  // address?: string; // Consider adding address field
  // stateCode?: string; // For IGST calculation if address is detailed
  createdAt?: Timestamp; // Firestore Timestamp
}

// Zod schema for customer form validation
const customerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }).regex(/^\d+[\d\s-]*$/, { message: "Phone number must contain valid characters (digits, spaces, hyphens)."}),
  gstin: z.string().optional().or(z.literal('')),
  // address: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

/**
 * Retrieves a cookie value by name.
 * @param {string} name - The name of the cookie.
 * @returns {string | undefined} The cookie value or undefined if not found.
 */
const getCookie = (name: string): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

/**
 * CustomersPage component.
 * Provides UI and logic for managing customer data in Firestore.
 * @returns {JSX.Element} The rendered customers page.
 */
export default function CustomersPage() {
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
    defaultValues: { name: "", email: "", phone: "", gstin: "" },
  });

  /**
   * Fetches customer list from Firestore.
   */
  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "customers"), orderBy("name", "asc")); // Sort by name
      const querySnapshot = await getDocs(q);
      const fetchedCustomers = querySnapshot.docs.map(docSnapshot => {
          const data = docSnapshot.data();
          return { 
              id: docSnapshot.id,
              name: data.name,
              email: data.email || "", // Ensure email is not undefined
              phone: data.phone,
              gstin: data.gstin || "",
              totalSpent: data.totalSpent || "₹0.00", // Placeholder until calculated
          } as Customer;
      });
      setCustomerList(fetchedCustomers);
    } catch (error) {
      console.error("Error fetching customers: ", error);
      toast({ title: "Error", description: "Could not load customers from database.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setCurrentUserRole(getCookie('userRole'));
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (editingCustomer && isEditCustomerDialogOpen) {
      form.reset({
        name: editingCustomer.name,
        email: editingCustomer.email,
        phone: editingCustomer.phone,
        gstin: editingCustomer.gstin || "",
      });
    } else {
      form.reset({ name: "", email: "", phone: "", gstin: "" });
    }
  }, [editingCustomer, isEditCustomerDialogOpen, form]);

  const handleAddSubmit = async (values: CustomerFormValues) => {
    try {
      const newCustomerData = { 
        ...values, 
        email: values.email || "", // Ensure email is not undefined if empty
        totalSpent: "₹0.00", // Initial value
        createdAt: serverTimestamp() 
      };
      const docRef = await addDoc(collection(db, "customers"), newCustomerData);
      // setCustomerList((prev) => [{ id: docRef.id, ...newCustomerData, createdAt: new Timestamp(Date.now()/1000,0) }, ...prev]);
      toast({ title: "Customer Added", description: `${values.name} has been successfully added to Firestore.` });
      fetchCustomers(); // Re-fetch to get the latest list including the new one
      form.reset();
      setIsAddCustomerDialogOpen(false);
    } catch (error) {
      console.error("Error adding customer: ", error);
      toast({ title: "Error", description: "Failed to add customer to database.", variant: "destructive" });
    }
  };

  const handleEditSubmit = async (values: CustomerFormValues) => {
    if (!editingCustomer) return;
    try {
      const customerRef = doc(db, "customers", editingCustomer.id);
      const updatedData = { ...values, email: values.email || "" };
      await updateDoc(customerRef, updatedData);
      // setCustomerList((prev) => prev.map((c) => (c.id === editingCustomer.id ? { ...c, ...updatedData } : c)));
      toast({ title: "Customer Updated", description: `${values.name} has been successfully updated in Firestore.` });
      fetchCustomers(); // Re-fetch
      setEditingCustomer(null);
      setIsEditCustomerDialogOpen(false);
      form.reset();
    } catch (error) {
      console.error("Error updating customer: ", error);
      toast({ title: "Error", description: "Failed to update customer in database.", variant: "destructive" });
    }
  };
  
  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsEditCustomerDialogOpen(true);
  };

  const openDeleteDialog = (customer: Customer) => {
    if (currentUserRole !== 'admin') {
      toast({ title: "Permission Denied", description: "Only Admins can delete customers.", variant: "destructive"});
      return;
    }
    setCustomerToDelete(customer);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!customerToDelete || currentUserRole !== 'admin') return;
    try {
      await deleteDoc(doc(db, "customers", customerToDelete.id));
      // setCustomerList((prev) => prev.filter((c) => c.id !== customerToDelete.id));
      toast({ title: "Customer Deleted", description: `${customerToDelete.name} has been successfully deleted from Firestore.`, variant: "default" });
      fetchCustomers(); // Re-fetch
      setCustomerToDelete(null);
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      console.error("Error deleting customer: ", error);
      toast({ title: "Error", description: "Failed to delete customer from database.", variant: "destructive" });
    }
  };

  const handleViewDetails = (customer: Customer) => {
    toast({ title: "View Details (Placeholder)", description: `Viewing details for ${customer.name}. Purchase/payment history page to be implemented.`});
    // Future: router.push(`/customers/${customer.id}`);
  };

  const handleUpdatePaymentStatus = (customer: Customer) => {
    toast({ title: "Update Payment Status (Placeholder)", description: `Functionality to update payment status for ${customer.name}'s bills to be implemented.`});
    // Future: This would likely involve selecting a specific bill and then updating its status in Firestore.
  };

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

      {/* Add/Edit Customer Dialog (shared form) */}
      <Dialog 
        open={isAddCustomerDialogOpen || isEditCustomerDialogOpen} 
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setIsAddCustomerDialogOpen(false);
            setIsEditCustomerDialogOpen(false);
            setEditingCustomer(null);
            form.reset();
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
            <form onSubmit={form.handleSubmit(editingCustomer ? handleEditSubmit : handleAddSubmit)} className="space-y-4 py-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Priya Sharma" {...field} /></FormControl>
                    <FormMessage />
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
              {/* Future: Add <FormField control={form.control} name="address" ... /> */}
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="outline" onClick={() => { setIsAddCustomerDialogOpen(false); setIsEditCustomerDialogOpen(false); setEditingCustomer(null); }}>Cancel</Button></DialogClose>
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
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the customer &quot;{customerToDelete?.name}&quot; from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setIsDeleteConfirmOpen(false); setCustomerToDelete(null);}}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90" disabled={currentUserRole !== 'admin'}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Customer List</CardTitle>
          <CardDescription>A list of all registered customers from Firestore.</CardDescription>
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
                  <TableCell>{customer.email || "-"}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.gstin || "-"}</TableCell>
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
                        {(currentUserRole === 'store_manager' || currentUserRole === 'admin') && (
                            <DropdownMenuItem onClick={() => handleUpdatePaymentStatus(customer)}>
                                <CreditCard className="mr-2 h-4 w-4" /> Update Payment Status
                            </DropdownMenuItem>
                        )}
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
           {customerList.length === 0 && !isLoading && (
             <div className="text-center py-8 text-muted-foreground">
                No customers found in the database. Click "Add New Customer" to get started.
             </div>
           )}
        </CardContent>
      </Card>
    </>
  );
}
