
"use client";

import { useState, useEffect } from "react";
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

/**
 * @fileOverview Page for managing customer profiles.
 * Allows Admin to perform full CRUD operations on customers.
 * Allows Store Manager to:
 *  - Create new customers.
 *  - View customer list.
 *  - View customer details, past transactions, and payment history (placeholders).
 *  - Update payment status of customer bills (placeholder).
 * Store Managers cannot delete customers.
 */

interface Customer {
  id: string; // Firestore document ID or unique local ID
  name: string;
  email: string;
  phone: string;
  gstin?: string; // Optional GSTIN
  totalSpent: string; // Display string, e.g., "₹10,000.00"
  // Future: Add address, notes, creationDate, lastTransactionDate etc.
}

// Initial dummy data. This will be replaced by Firestore data in Phase 2.
const initialCustomers: Customer[] = [
  { id: "CUST-LOCAL-001", name: "Alice Wonderland", email: "alice@example.com", phone: "555-0101", gstin: "29AABCU9517R1Z5", totalSpent: "₹100,000.00" },
  { id: "CUST-LOCAL-002", name: "Bob The Builder", email: "bob@example.com", phone: "555-0102", totalSpent: "₹70,040.00" },
  { id: "CUST-LOCAL-003", name: "Charlie Chaplin", email: "charlie@example.com", phone: "555-0103", gstin: "07AABCS1234D1Z2", totalSpent: "₹184,060.00" },
  { id: "CUST-LOCAL-004", name: "Diana Prince", email: "diana@example.com", phone: "555-0104", totalSpent: "₹36,000.00" },
];

// Zod schema for customer form validation
const customerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }).regex(/^\d+$/, { message: "Phone number must contain only digits."}),
  gstin: z.string().optional().or(z.literal('')), // Future: Add more specific GSTIN validation if available (e.g., regex)
});

type CustomerFormValues = z.infer<typeof customerSchema>;

/**
 * Retrieves a cookie value by name.
 * @param name - The name of the cookie.
 * @returns The cookie value or undefined if not found.
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
 * Provides UI and logic for managing customer data.
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
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      gstin: "",
    },
  });

  // Effect to load user role and customers
  useEffect(() => {
    setCurrentUserRole(getCookie('userRole'));

    // Future: Fetch customers from Firestore
    // const fetchCustomers = async () => {
    //   setIsLoading(true);
    //   try {
    //     const querySnapshot = await getDocs(collection(db, "customers"));
    //     const fetchedCustomers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
    //     setCustomerList(fetchedCustomers);
    //   } catch (error) {
    //     console.error("Error fetching customers: ", error);
    //     toast({ title: "Error", description: "Could not load customers.", variant: "destructive" });
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    // fetchCustomers();

    // Phase 1: Use local data
    setCustomerList(initialCustomers);
    setIsLoading(false);
  }, [toast]);

  // Effect to reset form when edit dialog opens/closes or editingCustomer changes
  useEffect(() => {
    if (editingCustomer && isEditCustomerDialogOpen) {
      form.reset({
        name: editingCustomer.name,
        email: editingCustomer.email,
        phone: editingCustomer.phone,
        gstin: editingCustomer.gstin || "",
      });
    } else {
      form.reset({ name: "", email: "", phone: "", gstin: "" }); // Reset for add dialog or on close
    }
  }, [editingCustomer, isEditCustomerDialogOpen, form]);


  /**
   * Handles submission of the "Add New Customer" form.
   * Phase 1: Adds to local state.
   * Future: Adds customer to Firestore.
   */
  const handleAddSubmit = (values: CustomerFormValues) => {
    // Future: Firebase integration
    // try {
    //   const newCustomerData = { ...values, totalSpent: "₹0.00", createdAt: serverTimestamp() };
    //   const docRef = await addDoc(collection(db, "customers"), newCustomerData);
    //   setCustomerList((prev) => [{ id: docRef.id, ...newCustomerData }, ...prev]);
    // } catch (error) {
    //   console.error("Error adding customer: ", error);
    //   toast({ title: "Error", description: "Failed to add customer.", variant: "destructive" });
    //   return;
    // }

    // Phase 1: Local state update
    const newId = `CUST-LOCAL-${Date.now()}`;
    const newCustomer: Customer = {
      id: newId,
      ...values,
      email: values.email || "", // Ensure email is not undefined
      totalSpent: "₹0.00",
    };
    setCustomerList((prevCustomers) => [newCustomer, ...prevCustomers]);
    toast({
      title: "Customer Added (Locally)",
      description: `${values.name} has been successfully added.`,
    });
    form.reset();
    setIsAddCustomerDialogOpen(false);
  };

  /**
   * Handles submission of the "Edit Customer" form.
   * Phase 1: Updates local state.
   * Future: Updates customer in Firestore.
   */
  const handleEditSubmit = (values: CustomerFormValues) => {
    if (!editingCustomer) return;

    // Future: Firebase integration
    // try {
    //   const customerRef = doc(db, "customers", editingCustomer.id);
    //   const updatedData = { ...values, email: values.email || "" }; // Ensure email is not undefined
    //   await updateDoc(customerRef, updatedData);
    //   setCustomerList((prev) =>
    //     prev.map((c) => (c.id === editingCustomer.id ? { ...c, ...updatedData } : c))
    //   );
    // } catch (error) {
    //   console.error("Error updating customer: ", error);
    //   toast({ title: "Error", description: "Failed to update customer.", variant: "destructive" });
    //   return;
    // }

    // Phase 1: Local state update
    const updatedCustomer: Customer = {
      ...editingCustomer,
      ...values,
      email: values.email || "", // Ensure email is not undefined
    };
    setCustomerList((prevCustomers) =>
      prevCustomers.map((c) => (c.id === editingCustomer.id ? updatedCustomer : c))
    );
    toast({
      title: "Customer Updated (Locally)",
      description: `${values.name} has been successfully updated.`,
    });
    setEditingCustomer(null);
    setIsEditCustomerDialogOpen(false);
    form.reset();
  };
  
  /**
   * Opens the edit dialog and populates form with customer data.
   */
  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsEditCustomerDialogOpen(true);
  };

  /**
   * Opens the delete confirmation dialog (Admin only).
   */
  const openDeleteDialog = (customer: Customer) => {
    if (currentUserRole !== 'admin') {
      toast({ title: "Permission Denied", description: "Only Admins can delete customers.", variant: "destructive"});
      return;
    }
    setCustomerToDelete(customer);
    setIsDeleteConfirmOpen(true);
  };

  /**
   * Confirms and performs customer deletion (Admin only).
   * Phase 1: Removes from local state.
   * Future: Deletes customer from Firestore.
   */
  const confirmDelete = () => {
    if (!customerToDelete || currentUserRole !== 'admin') return;

    // Future: Firebase integration
    // try {
    //   await deleteDoc(doc(db, "customers", customerToDelete.id));
    //   setCustomerList((prev) => prev.filter((c) => c.id !== customerToDelete.id));
    // } catch (error) {
    //   console.error("Error deleting customer: ", error);
    //   toast({ title: "Error", description: "Failed to delete customer.", variant: "destructive" });
    //   return;
    // }

    // Phase 1: Local state update
    setCustomerList((prevCustomers) => prevCustomers.filter((c) => c.id !== customerToDelete.id));
    toast({
      title: "Customer Deleted (Locally)",
      description: `${customerToDelete.name} has been successfully deleted.`,
      variant: "destructive"
    });
    setCustomerToDelete(null);
    setIsDeleteConfirmOpen(false);
  };

  /**
   * Placeholder for viewing customer details and history.
   */
  const handleViewDetails = (customer: Customer) => {
    // Future: Navigate to a dedicated customer detail page, e.g., router.push(`/customers/${customer.id}`);
    toast({
        title: "View Details (Placeholder)",
        description: `Viewing details for ${customer.name}. Purchase/payment history page to be implemented.`,
    });
  }

  /**
   * Placeholder for updating payment status of a customer's bill.
   */
  const handleUpdatePaymentStatus = (customer: Customer) => {
     // Future: This would likely involve selecting a specific bill and then updating its status.
     // Could open a dialog listing unpaid bills for this customer.
    toast({
        title: "Update Payment Status (Placeholder)",
        description: `Functionality to update payment status for ${customer.name}'s bills to be implemented.`,
    });
  }

  if (isLoading) {
    return <PageHeader title="Manage Customers" description="Loading customer data..." icon={Users} />;
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

      {/* Add Customer Dialog */}
      <Dialog open={isAddCustomerDialogOpen} onOpenChange={(isOpen) => {
          setIsAddCustomerDialogOpen(isOpen);
          if (!isOpen) form.reset(); // Reset form if dialog is closed without submitting
        }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Fill in the details to add a new customer.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddSubmit)} className="space-y-4 py-2">
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
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit">Add Customer</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
       <Dialog open={isEditCustomerDialogOpen} onOpenChange={(isOpen) => {
          setIsEditCustomerDialogOpen(isOpen);
          if (!isOpen) setEditingCustomer(null); // Clear editing customer if dialog is closed
        }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Update the details for &quot;{editingCustomer?.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-4 py-2">
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
              <DialogFooter className="pt-4">
                 <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={() => { setIsEditCustomerDialogOpen(false); setEditingCustomer(null); }}>
                      Cancel
                    </Button>
                  </DialogClose>
                <Button type="submit">Save Changes</Button>
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
          <CardDescription>A list of all registered customers.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer ID</TableHead>
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
                  <TableCell className="font-medium">{customer.id}</TableCell>
                  <TableCell>{customer.name}</TableCell>
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
                        {currentUserRole === 'store_manager' && (
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
                No customers found. Click "Add New Customer" to get started.
             </div>
           )}
        </CardContent>
      </Card>
      {/* 
        Phase 1 Data Storage: Customer data is stored in local component state.
        Phase 2 (Future-Ready):
        - Customer data will be stored in a 'customers' collection in Firebase Firestore.
        - Each document would represent a customer with fields like name, email, phone, gstin, address, totalSpent (potentially calculated or updated via transactions), createdAt, etc.
        - Adding a customer would create a new document in this collection.
        - Editing would update the corresponding document.
        - Deleting (Admin only) would remove the document.
        - Total spent could be a denormalized field updated by a Firebase Function observing new bills/payments, or calculated on read (less performant for lists).
        - Customer history would involve querying a 'bills' or 'transactions' collection filtered by customer ID.
      */}
    </>
  );
}
