
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Users, PlusCircle, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

// Basic cookie utility
const getCookie = (name: string): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  gstin?: string; // Optional GSTIN
  totalSpent: string; // Keep as string for display
}

const initialCustomers: Customer[] = [
  { id: "CUST001", name: "Alice Wonderland", email: "alice@example.com", phone: "555-0101", gstin: "29AABCU9517R1Z5", totalSpent: "₹100,000.00" },
  { id: "CUST002", name: "Bob The Builder", email: "bob@example.com", phone: "555-0102", totalSpent: "₹70,040.00" },
  { id: "CUST003", name: "Charlie Chaplin", email: "charlie@example.com", phone: "555-0103", gstin: "07AABCS1234D1Z2", totalSpent: "₹184,060.00" },
  { id: "CUST004", name: "Diana Prince", email: "diana@example.com", phone: "555-0104", totalSpent: "₹36,000.00" },
];

const customerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
  gstin: z.string().optional().or(z.literal('')), // Add more specific GSTIN validation if needed
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export default function CustomersPage() {
  const [customerList, setCustomerList] = useState<Customer[]>(initialCustomers);
  const [isAddCustomerDialogOpen, setIsAddCustomerDialogOpen] = useState(false);
  const [isEditCustomerDialogOpen, setIsEditCustomerDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [userRole, setUserRole] = useState<string | undefined>(undefined);

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

  useEffect(() => {
    setUserRole(getCookie('userRole'));
    // Placeholder for fetching customers from a data source
    // async function fetchCustomers() {
    //   // const fetchedCustomers = await db.getCustomers(); // Future cloud integration
    //   // setCustomerList(fetchedCustomers);
    // }
    // fetchCustomers();
    // For now, using initialCustomers
    setCustomerList(initialCustomers);
  }, []);

  useEffect(() => {
    if (editingCustomer && isEditCustomerDialogOpen) {
      form.reset({
        name: editingCustomer.name,
        email: editingCustomer.email,
        phone: editingCustomer.phone,
        gstin: editingCustomer.gstin,
      });
    } else {
      form.reset({ name: "", email: "", phone: "", gstin: "" });
    }
  }, [editingCustomer, isEditCustomerDialogOpen, form]);


  const handleAddSubmit = (values: CustomerFormValues) => {
    // For future cloud integration:
    // try {
    //   const newCustomerData = { ...values, totalSpent: "₹0.00" }; // Assuming new customer starts with 0 spent
    //   const createdCustomer = await api.createCustomer(newCustomerData); // Example API call
    //   setCustomerList((prev) => [createdCustomer, ...prev]);
    // } catch (error) {
    //   toast({ title: "Error", description: "Failed to add customer.", variant: "destructive" });
    //   return;
    // }

    const newId = `CUST-${Date.now()}`;
    const newCustomer: Customer = {
      id: newId,
      ...values,
      totalSpent: "₹0.00",
    };
    setCustomerList((prevCustomers) => [newCustomer, ...prevCustomers]);
    toast({
      title: "Customer Added",
      description: `${values.name} has been successfully added.`,
    });
    form.reset();
    setIsAddCustomerDialogOpen(false);
  };

  const handleEditSubmit = (values: CustomerFormValues) => {
    if (!editingCustomer) return;

    // For future cloud integration:
    // try {
    //   const updatedCustomerData = { ...editingCustomer, ...values };
    //   await api.updateCustomer(editingCustomer.id, updatedCustomerData); // Example API call
    //   setCustomerList((prev) =>
    //     prev.map((c) => (c.id === editingCustomer.id ? updatedCustomerData : c))
    //   );
    // } catch (error) {
    //   toast({ title: "Error", description: "Failed to update customer.", variant: "destructive" });
    //   return;
    // }

    const updatedCustomer: Customer = {
      ...editingCustomer,
      ...values,
    };
    setCustomerList((prevCustomers) =>
      prevCustomers.map((c) => (c.id === editingCustomer.id ? updatedCustomer : c))
    );
    toast({
      title: "Customer Updated",
      description: `${values.name} has been successfully updated.`,
    });
    setEditingCustomer(null);
    setIsEditCustomerDialogOpen(false);
    form.reset();
  };
  
  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsEditCustomerDialogOpen(true);
  };

  const openDeleteDialog = (customer: Customer) => {
    setCustomerToDelete(customer);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!customerToDelete || userRole !== 'admin') return;

    // For future cloud integration:
    // try {
    //   await api.deleteCustomer(customerToDelete.id); // Example API call
    //   setCustomerList((prev) => prev.filter((c) => c.id !== customerToDelete.id));
    // } catch (error) {
    //   toast({ title: "Error", description: "Failed to delete customer.", variant: "destructive" });
    //   return;
    // }

    setCustomerList((prevCustomers) => prevCustomers.filter((c) => c.id !== customerToDelete.id));
    toast({
      title: "Customer Deleted",
      description: `${customerToDelete.name} has been successfully deleted.`,
      variant: "destructive"
    });
    setCustomerToDelete(null);
    setIsDeleteConfirmOpen(false);
  };

  const handleViewDetails = (customer: Customer) => {
    // This would typically navigate to a customer detail page
    // router.push(`/customers/${customer.id}`);
    toast({
        title: "View Details (Placeholder)",
        description: `Viewing details for ${customer.name}. Purchase/payment history page to be implemented.`,
    });
  }

  return (
    <>
      <PageHeader
        title="Manage Customers"
        description="Manage customer profiles, sales history, and payment information."
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
          if (!isOpen) form.reset();
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
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Priya Sharma" {...field} />
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
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., priya@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 9876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 29AABCU9517R1Z5" {...field} />
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
                <Button type="submit">Add Customer</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
       <Dialog open={isEditCustomerDialogOpen} onOpenChange={(isOpen) => {
          setIsEditCustomerDialogOpen(isOpen);
          if (!isOpen) setEditingCustomer(null);
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
            <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Priya Sharma" {...field} />
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
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="e.g., priya@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 9876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GSTIN (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 29AABCU9517R1Z5" {...field} />
                    </FormControl>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the customer &quot;{customerToDelete?.name}&quot; from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCustomerToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90" disabled={userRole !== 'admin'}>
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
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(customer)}>
                            <Eye className="mr-2 h-4 w-4" /> View Details & History
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(customer)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Customer
                        </DropdownMenuItem>
                        {/* Manager can update payment status here or on detail page - To be implemented */}
                        {userRole === 'admin' && (
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
        </CardContent>
      </Card>
      {/* Comment for future data persistence:
          The 'customerList' state is currently managed locally.
          In a production environment with cloud integration (e.g., Firebase Firestore):
          - Customers would be fetched from the database in useEffect.
          - Add, edit, delete operations would call API endpoints that interact with the cloud database.
          - Example: `await firestore.collection('customers').add(newCustomerData);`
          - Example: `await firestore.collection('customers').doc(customerId).update(updatedData);`
          - Role-based access for deletion would be enforced server-side.
      */}
    </>
  );
}

    