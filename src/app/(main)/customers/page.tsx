
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Users, PlusCircle, MoreHorizontal, Edit, Trash2, Eye, CreditCard, UserPlus, FileWarning, BookOpen, ReceiptText, Activity } from "lucide-react"; 
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, where, limit } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig'; 
import { useRouter, useSearchParams } from 'next/navigation';
import type { PaymentRecord } from './../payments/page';
import type { LedgerEntry } from './../ledger/page';
import { format, parseISO } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export interface Customer {
  id: string; 
  name: string;
  email: string | null; 
  phone: string;
  gstin?: string | null; 
  totalSpent: string; // This will be less relied upon, calculated dynamically
  address?: string | null; 
  createdAt?: Timestamp; 
  createdBy?: string; 
  updatedAt?: Timestamp; 
}

interface CustomerDetailsView extends Customer {
  payments: PaymentRecord[];
  ledgerEntries: LedgerEntry[];
  totalAmountPaid: number;
  totalBalanceDue: number;
  pendingLedgerEntriesCount: number;
}

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

const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getCookie = (name: string): string | undefined => {
  if (typeof window === 'undefined') return undefined; 
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

const ITEMS_PER_PAGE_DETAILS_DIALOG = 50;

export default function CustomersPage() {
  const router = useRouter();
  const searchParams = useSearchParams(); 

  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false); 
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>(undefined);

  const [isDetailsViewOpen, setIsDetailsViewOpen] = useState(false);
  const [selectedCustomerForDetails, setSelectedCustomerForDetails] = useState<CustomerDetailsView | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [ledgerEntriesCurrentPage, setLedgerEntriesCurrentPage] = useState(1);
  
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
              id: docSnapshot.id, name: data.name, email: data.email || null, 
              phone: data.phone, gstin: data.gstin || null, address: data.address || null,
              totalSpent: data.totalSpent || "₹0.00", createdAt: data.createdAt,
              createdBy: data.createdBy, updatedAt: data.updatedAt,
          } as Customer;
      });
      setCustomerList(fetchedCustomers);
    } catch (error: any) {
      console.error("Error fetching customers: ", error);
      toast({ title: "Database Error", description: `Could not load customers: ${error.message}`, variant: "destructive" });
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
          name: editingCustomer.name, email: editingCustomer.email || "", phone: editingCustomer.phone,
          gstin: editingCustomer.gstin || "", address: editingCustomer.address || "",
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
        name: values.name, email: (values.email === undefined || values.email.trim() === "") ? null : values.email.trim(),
        phone: values.phone, gstin: (values.gstin === undefined || values.gstin.trim() === "") ? null : values.gstin.trim(),
        address: (values.address === undefined || values.address.trim() === "") ? null : values.address.trim(),
    };
    try {
      if (editingCustomer) {
        const customerRef = doc(db, "customers", editingCustomer.id);
        await updateDoc(customerRef, { ...dataToSave, updatedAt: serverTimestamp() });
        toast({ title: "Customer Updated", description: `${values.name} has been successfully updated.` });
      } else {
        await addDoc(collection(db, "customers"), { 
          ...dataToSave, totalSpent: "₹0.00", createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(), createdBy: currentFirebaseUser.uid, 
        });
        toast({ title: "Customer Added", description: `${values.name} has been successfully added.` });
      }
      fetchCustomers(); form.reset(); setIsFormDialogOpen(false); setEditingCustomer(null);
    } catch (error: any) {
      toast({ title: "Save Error", description: `Failed to save customer: ${error.message}`, variant: "destructive" });
    }
  };
  
  const openAddDialog = () => { setEditingCustomer(null); setIsFormDialogOpen(true); };
  const openEditDialog = (customer: Customer) => { setEditingCustomer(customer); setIsFormDialogOpen(true); };

  const openDeleteDialog = (customer: Customer) => {
    if (currentUserRole !== 'admin') { 
      toast({ title: "Permission Denied", description: "Only Admins can delete customers.", variant: "destructive"});
      return;
    }
    setCustomerToDelete(customer); setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!customerToDelete || currentUserRole !== 'admin') return;
    try {
      await deleteDoc(doc(db, "customers", customerToDelete.id));
      toast({ title: "Customer Deleted", description: `${customerToDelete.name} has been successfully deleted.`, variant: "default" });
      fetchCustomers(); 
    } catch (error: any) {
      toast({ title: "Deletion Error", description: `Failed to delete customer: ${error.message}`, variant: "destructive" });
    } finally { setCustomerToDelete(null); setIsDeleteConfirmOpen(false); }
  };

  const handleViewDetails = async (customer: Customer) => {
    setIsLoadingDetails(true);
    setIsDetailsViewOpen(true);
    setLedgerEntriesCurrentPage(1);
    try {
      const paymentsQuery = query(collection(db, "payments"), where("relatedEntityId", "==", customer.id), where("type", "==", "customer"), orderBy("isoDate", "desc"));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const fetchedPayments = paymentsSnapshot.docs.map(d => {
          const data = d.data();
           return { ...data, id: d.id, displayAmountPaid: formatCurrency(data.amountPaid || 0) } as PaymentRecord
      });

      const ledgerEntriesQuery = query(collection(db, "ledgerEntries"), where("entityId", "==", customer.id), where("type", "==", "sale"), orderBy("date", "desc"), orderBy("createdAt", "desc"));
      const ledgerSnapshot = await getDocs(ledgerEntriesQuery);
      const fetchedLedgerEntries = ledgerSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as LedgerEntry));
      
      const totalAmountPaid = fetchedPayments
        .filter(p => p.status === 'Completed' || p.status === 'Received' || p.status === 'Partial')
        .reduce((sum, p) => sum + p.amountPaid, 0);
      
      const totalBalanceDue = fetchedLedgerEntries
        .reduce((sum, entry) => sum + (entry.remainingAmount || 0), 0);
      
      const pendingLedgerEntriesCount = fetchedLedgerEntries
        .filter(entry => entry.paymentStatus === 'pending' || entry.paymentStatus === 'partial')
        .length;

      setSelectedCustomerForDetails({
        ...customer,
        payments: fetchedPayments,
        ledgerEntries: fetchedLedgerEntries,
        totalAmountPaid: totalAmountPaid,
        totalBalanceDue: totalBalanceDue,
        pendingLedgerEntriesCount: pendingLedgerEntriesCount,
      });

    } catch (error: any) {
      console.error("Error fetching customer details:", error);
      toast({ title: "Details Error", description: "Could not load full customer details.", variant: "destructive" });
      setSelectedCustomerForDetails(null);
      setIsDetailsViewOpen(false);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleUpdatePaymentStatus = (customer: Customer) => {
    router.push(`/payments?type=customer&entityId=${customer.id}&entityName=${encodeURIComponent(customer.name)}`);
  };

  const handleGoToLedgerForPending = (customerName: string) => {
    router.push(`/ledger?entityName=${encodeURIComponent(customerName)}&paymentStatus=pending_partial&type=sale`);
    setIsDetailsViewOpen(false);
  };
  
  const paginatedLedgerEntries = useMemo(() => {
    if (!selectedCustomerForDetails) return [];
    const startIndex = (ledgerEntriesCurrentPage - 1) * ITEMS_PER_PAGE_DETAILS_DIALOG;
    const endIndex = startIndex + ITEMS_PER_PAGE_DETAILS_DIALOG;
    return selectedCustomerForDetails.ledgerEntries.slice(startIndex, endIndex);
  }, [selectedCustomerForDetails, ledgerEntriesCurrentPage]);

  const totalLedgerPages = selectedCustomerForDetails ? Math.ceil(selectedCustomerForDetails.ledgerEntries.length / ITEMS_PER_PAGE_DETAILS_DIALOG) : 0;


  if (isLoading && customerList.length === 0) {
    return <PageHeader title="Manage Customers" description="Loading customer data from database..." icon={Users} />;
  }

  return (
    <>
      <PageHeader title="Manage Customers" description="View, add, and edit customer profiles. Admins can also delete." icon={Users}
        actions={<Button onClick={openAddDialog} className="mt-4 sm:mt-0"><PlusCircle className="mr-2 h-4 w-4" />Add New Customer</Button>}
      />

      <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => {
          if (!isOpen) { setIsFormDialogOpen(false); setEditingCustomer(null); form.reset(); if (searchParams.get('addNew') === 'true') router.replace('/customers', { scroll: false }); } 
          else { setIsFormDialogOpen(true); }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
            <DialogDescription>{editingCustomer ? `Update details for "${editingCustomer.name}".` : "Fill in the details to add a new customer."}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g., Priya Sharma" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email (Optional)</FormLabel><FormControl><Input type="email" placeholder="e.g., priya@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="e.g., 9876543210" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="gstin" render={({ field }) => (<FormItem><FormLabel>GSTIN (Optional)</FormLabel><FormControl><Input placeholder="e.g., 29AABCU9517R1Z5" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address (Optional)</FormLabel><FormControl><Input placeholder="e.g., 123 Main St, Bangalore" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 border-t -mx-6 px-6 flex flex-col sm:flex-row gap-2">
                <DialogClose asChild><Button type="button" variant="outline" className="w-full sm:w-auto">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">{form.formState.isSubmitting ? (editingCustomer ? "Saving..." : "Adding...") : (editingCustomer ? "Save Changes" : "Add Customer")}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setCustomerToDelete(null); setIsDeleteConfirmOpen(isOpen);}}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the customer &quot;{customerToDelete?.name}&quot; from the database.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => {setIsDeleteConfirmOpen(false); setCustomerToDelete(null);}}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90" disabled={currentUserRole !== 'admin'}>Delete Customer</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isDetailsViewOpen} onOpenChange={(isOpen) => { if(!isOpen) setSelectedCustomerForDetails(null); setIsDetailsViewOpen(isOpen); }}>
        <DialogContent className="max-w-3xl w-[95vw] h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Customer Details: {selectedCustomerForDetails?.name}</DialogTitle>
                <DialogDescription>Comprehensive overview of customer activity and financials.</DialogDescription>
            </DialogHeader>
            {isLoadingDetails ? (<div className="flex-grow flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading details...</span></div>)
            : selectedCustomerForDetails ? (
            <ScrollArea className="flex-grow pr-2 -mr-2">
                <div className="space-y-6 py-2 overflow-x-auto">
                    <Card>
                        <CardHeader><CardTitle className="text-lg">Financial Summary</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            <div className="sm:col-span-1"><p className="text-muted-foreground">Total Paid (from Payments):</p><p className="font-semibold text-green-600">{formatCurrency(selectedCustomerForDetails.totalAmountPaid)}</p></div>
                            <div className="sm:col-span-1"><p className="text-muted-foreground">Total Balance Due (from Ledger):</p><p className="font-semibold text-red-600">{formatCurrency(selectedCustomerForDetails.totalBalanceDue)}</p></div>
                            <Button variant="link" size="sm" className="p-0 h-auto justify-start text-left sm:col-span-1" onClick={() => handleGoToLedgerForPending(selectedCustomerForDetails.name)}>
                                <div><p className="text-muted-foreground">Pending/Partial Ledger Entries:</p><p className="font-semibold text-blue-600">{selectedCustomerForDetails.pendingLedgerEntriesCount} (View in Ledger)</p></div>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-lg">Payment History ({selectedCustomerForDetails.payments.length})</CardTitle></CardHeader>
                        <CardContent>
                            {selectedCustomerForDetails.payments.length > 0 ? (
                                <div className="overflow-x-auto">
                                <Table className="text-xs min-w-[600px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead>Ref ID</TableHead></TableRow></TableHeader>
                                <TableBody>{selectedCustomerForDetails.payments.slice(0, 5).map(p => (<TableRow key={p.id}><TableCell>{p.date}</TableCell><TableCell>{p.displayAmountPaid}</TableCell><TableCell>{p.method || 'N/A'}</TableCell><TableCell><Badge variant={p.status === "Completed" || p.status === "Received" ? "default" : "secondary"}>{p.status}</Badge></TableCell><TableCell>{p.relatedInvoiceId || p.ledgerEntryId || 'N/A'}</TableCell></TableRow>))}
                                </TableBody></Table>
                                </div>
                            ) : (<p className="text-sm text-muted-foreground">No payment records found for this customer.</p>)}
                            {selectedCustomerForDetails.payments.length > 5 && <p className="text-xs text-muted-foreground mt-2 text-center">Showing last 5 payments. Full history in Payments section.</p>}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle className="text-lg">Ledger Entries (Sales) ({selectedCustomerForDetails.ledgerEntries.length})</CardTitle></CardHeader>
                        <CardContent>
                            {selectedCustomerForDetails.ledgerEntries.length > 0 ? (
                                <>
                                <div className="overflow-x-auto">
                                <Table className="text-xs min-w-[600px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Pymt Status</TableHead></TableRow></TableHeader>
                                <TableBody>{paginatedLedgerEntries.map(le => (<TableRow key={le.id}><TableCell>{le.date}</TableCell><TableCell>{le.items.map(i => i.productName).join(', ').substring(0,30)}...</TableCell><TableCell className="text-right">{formatCurrency(le.grandTotal)}</TableCell><TableCell><Badge variant={le.paymentStatus === 'paid' ? 'default' : (le.paymentStatus === 'partial' ? 'outline' : 'secondary')}>{le.paymentStatus}</Badge></TableCell></TableRow>))}
                                </TableBody></Table>
                                </div>
                                {totalLedgerPages > 1 && (
                                    <div className="flex justify-center items-center gap-2 mt-4">
                                        <Button variant="outline" size="sm" onClick={() => setLedgerEntriesCurrentPage(p => Math.max(1, p-1))} disabled={ledgerEntriesCurrentPage === 1}>Prev</Button>
                                        <span className="text-xs text-muted-foreground">Page {ledgerEntriesCurrentPage} of {totalLedgerPages}</span>
                                        <Button variant="outline" size="sm" onClick={() => setLedgerEntriesCurrentPage(p => Math.min(totalLedgerPages, p+1))} disabled={ledgerEntriesCurrentPage === totalLedgerPages}>Next</Button>
                                    </div>
                                )}
                                </>
                            ) : (<p className="text-sm text-muted-foreground">No sales ledger entries found for this customer.</p>)}
                        </CardContent>
                    </Card>
                </div>
            </ScrollArea>
            ) : (<div className="flex-grow flex items-center justify-center"><p className="text-muted-foreground">No customer selected or details not found.</p></div>)
            }
            <DialogFooter className="pt-4 mt-auto border-t"><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="shadow-lg rounded-xl">
        <CardHeader><CardTitle className="font-headline text-foreground">Customer List</CardTitle><CardDescription>A list of all registered customers from Firestore, ordered alphabetically.</CardDescription></CardHeader>
        <CardContent>
          {isLoading && customerList.length === 0 ? (<div className="text-center py-10 text-muted-foreground">Loading customers...</div>)
           : !isLoading && customerList.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-10 text-center">
                <UserPlus className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" /><p className="text-lg sm:text-xl font-semibold text-muted-foreground">No Customers Found</p>
                <p className="text-xs sm:text-sm text-muted-foreground mb-6">It looks like there are no customers in your database yet.</p><Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Add New Customer</Button>
            </div>)
           : (<div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="hidden sm:table-cell">Email</TableHead><TableHead>Phone</TableHead><TableHead className="hidden md:table-cell">GSTIN</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>{customerList.map((customer) => (<TableRow key={customer.id}><TableCell className="font-medium">{customer.name}</TableCell><TableCell className="hidden sm:table-cell">{customer.email || "N/A"}</TableCell><TableCell>{customer.phone}</TableCell><TableCell className="hidden md:table-cell">{customer.gstin || "N/A"}</TableCell>
                    <TableCell className="text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Actions for {customer.name}</span></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDetails(customer)}><Eye className="mr-2 h-4 w-4" /> View Full Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(customer)}><Edit className="mr-2 h-4 w-4" /> Edit Customer</DropdownMenuItem>
                          {(currentUserRole === 'store_manager' || currentUserRole === 'admin') && (<DropdownMenuItem onClick={() => handleUpdatePaymentStatus(customer)}><CreditCard className="mr-2 h-4 w-4" /> Manage Payments</DropdownMenuItem>)}
                          {currentUserRole === 'admin' && (<DropdownMenuItem onClick={() => openDeleteDialog(customer)} className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground"><Trash2 className="mr-2 h-4 w-4" /> Delete Customer</DropdownMenuItem>)}
                        </DropdownMenuContent></DropdownMenu></TableCell></TableRow>))}
              </TableBody></Table></div>)}
        </CardContent>
      </Card>
    </>
  );
}
