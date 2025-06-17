
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Users, PlusCircle, MoreHorizontal, Edit, Trash2, Eye, CreditCard, UserPlus } from "lucide-react"; 
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
import { db, auth } from '@/lib/firebase/firebaseConfig'; 
import { useRouter, useSearchParams } from 'next/navigation';


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
  email: string | null; 
  phone: string;
  gstin?: string | null; 
  totalSpent: string; // Placeholder, calculated or updated separately
  address?: string | null; 
  createdAt?: Timestamp; 
  createdBy?: string; // UID of the user who created the customer
  updatedAt?: Timestamp; 
}

// Zod schema for customer form validation
const customerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }).regex(/^\d+[\d\s-]*$/, { message: "Phone number must contain valid characters (digits, spaces, hyphens)."}),
  gstin: z.string().optional().or(z.literal('')).refine(val => !val || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val), {
    message: "Invalid GSTIN format. Example: 29ABCDE1234F1Z5",
  }),
  address: z.string().optional(),
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
 * Handles CRUD operations, dialogs for add/edit, and role-based action availability.
 * @returns {JSX.Element} The rendered customers page.
 */
export default function CustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams(); 

  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false); // Single state for both add/edit
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>(undefined);

  const { toast } = useToast();

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", email: "", phone: "", gstin: "", address: "" },
  });

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
              email: data.email || null, 
              phone: data.phone,
              gstin: data.gstin || null,
              address: data.address || null,
              totalSpent: data.totalSpent || "₹0.00", 
              createdAt: data.createdAt,
              createdBy: data.createdBy,
              updatedAt: data.updatedAt,
          } as Customer;
      });
      setCustomerList(fetchedCustomers);
    } catch (error: any) {
      console.error("Error fetching customers: ", error);
      if (error.code === 'failed-precondition') {
         toast({
            title: "Database Index Required",
            description: `A query for customers failed. Please create the required Firestore index for 'customers' collection (orderBy 'name' ascending). Check your browser's developer console for a Firebase link to create it, or visit the Firestore indexes page in your Firebase console.`,
            variant: "destructive",
            duration: 15000,
        });
      } else {
        toast({ title: "Database Error", description: `Could not load customers: ${error.message}`, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setCurrentUserRole(getCookie('userRole'));
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (searchParams.get('addNew') === 'true') {
      setEditingCustomer(null); 
      form.reset({ name: "", email: "", phone: "", gstin: "", address: "" });
      setIsFormDialogOpen(true);
      router.replace('/customers', { scroll: false });
    }
  }, [searchParams, router, form]);


  useEffect(() => {
    if (isFormDialogOpen) {
      if (editingCustomer) {
        form.reset({
          name: editingCustomer.name,
          email: editingCustomer.email || "",
          phone: editingCustomer.phone,
          gstin: editingCustomer.gstin || "",
          address: editingCustomer.address || "",
        });
      } else { 
        form.reset({ name: "", email: "", phone: "", gstin: "", address: "" });
      }
    }
  }, [editingCustomer, isFormDialogOpen, form]);

  const handleFormSubmit = async (values: CustomerFormValues) => {
    const currentFirebaseUser = auth.currentUser;
    if (!currentFirebaseUser) { 
        toast({ title: "Authentication Error", description: "You must be logged in to add or edit a customer.", variant: "destructive"});
        return;
    }

    const dataToSave = {
        name: values.name,
        email: (values.email === undefined || values.email.trim() === "") ? null : values.email.trim(),
        phone: values.phone,
        gstin: (values.gstin === undefined || values.gstin.trim() === "") ? null : values.gstin.trim(),
        address: (values.address === undefined || values.address.trim() === "") ? null : values.address.trim(),
    };

    try {
      if (editingCustomer) {
        const customerRef = doc(db, "customers", editingCustomer.id);
        await updateDoc(customerRef, { ...dataToSave, updatedAt: serverTimestamp() });
        toast({ title: "Customer Updated", description: `${values.name} has been successfully updated.` });
      } else {
        await addDoc(collection(db, "customers"), { 
          ...dataToSave, 
          totalSpent: "₹0.00", 
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: currentFirebaseUser.uid, 
        });
        toast({ title: "Customer Added", description: `${values.name} has been successfully added.` });
      }
      fetchCustomers(); 
      form.reset();
      setIsFormDialogOpen(false);
      setEditingCustomer(null);
    } catch (error: any) {
      console.error("Error saving customer: ", error);
      toast({ title: "Save Error", description: `Failed to save customer: ${error.message}`, variant: "destructive" });
    }
  };
  
  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsFormDialogOpen(true);
  };
  
  const openAddDialog = () => {
    setEditingCustomer(null);
    setIsFormDialogOpen(true);
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
      toast({ title: "Customer Deleted", description: `${customerToDelete.name} has been successfully deleted.`, variant: "default" });
      fetchCustomers(); 
    } catch (error: any) {
      console.error("Error deleting customer: ", error);
      toast({ title: "Deletion Error", description: `Failed to delete customer: ${error.message}`, variant: "destructive" });
    } finally {
        setCustomerToDelete(null);
        setIsDeleteConfirmOpen(false);
    }
  };

  const handleViewDetails = (customer: Customer) => {
    toast({ title: "View Details (Placeholder)", description: `Viewing details for ${customer.name}. Purchase/payment history page to be implemented.`});
  };

  const handleUpdatePaymentStatus = (customer: Customer) => {
    router.push(`/payments?type=customer&entityId=${customer.id}&entityName=${encodeURIComponent(customer.name)}`);
  };

  if (isLoading && customerList.length === 0) {
    return <PageHeader title="Manage Customers" description="Loading customer data from database..." icon={Users} />;
  }

  return (
    <>
      <PageHeader
        title="Manage Customers"
        description="View, add, and edit customer profiles. Admins can also delete."
        icon={Users}
        actions={
          <Button onClick={openAddDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Customer
          </Button>
        }
      />

      <Dialog 
        open={isFormDialogOpen} 
        onOpenChange={(isOpen) => {
          if (!isOpen) { 
            setIsFormDialogOpen(false);
            setEditingCustomer(null);
            form.reset(); 
            if (searchParams.get('addNew') === 'true') { 
                 router.replace('/customers', { scroll: false });
            }
          } else { 
            setIsFormDialogOpen(true);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
            <DialogDescription>
              {editingCustomer ? `Update details for "${editingCustomer.name}".` : "Fill in the details to add a new customer."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-4">
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
               <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., 123 Main St, Bangalore" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 border-t -mx-6 px-6">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? (editingCustomer ? "Saving..." : "Adding...") : (editingCustomer ? "Save Changes" : "Add Customer")}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Customer List</CardTitle>
          <CardDescription>A list of all registered customers from Firestore, ordered alphabetically.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && customerList.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">Loading customers...</div>
          ) : !isLoading && customerList.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-10 text-center">
                <UserPlus className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-xl font-semibold text-muted-foreground">No Customers Found</p>
                <p className="text-sm text-muted-foreground mb-6">It looks like there are no customers in your database yet.</p>
                <Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Add New Customer</Button>
            </div>
           ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>GSTIN</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Total Spent</TableHead>
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
                    <TableCell className="text-right hidden sm:table-cell">{customer.totalSpent}</TableCell>
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
                                  <CreditCard className="mr-2 h-4 w-4" /> Manage Payments
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
           )}
        </CardContent>
      </Card>
    </>
  );
}

