
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Truck, PlusCircle, MoreHorizontal, Edit, Trash2, Eye, Banknote, FileWarning, BookOpen, ReceiptText, Activity } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp, where, limit } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
import { useRouter } from 'next/navigation'; 
import type { PaymentRecord } from './../payments/page';
import type { LedgerEntry } from './../ledger/page';
import { format, parseISO } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export interface Seller {
  id: string; 
  name: string; 
  contactPerson?: string | null; 
  email?: string | null; 
  phone: string; 
  address?: string | null; 
  gstin?: string | null; 
  bankDetails?: string | null; 
  purchaseTerms?: string | null; 
  createdAt?: Timestamp; 
  updatedAt?: Timestamp; 
}

interface SellerDetailsView extends Seller {
  payments: PaymentRecord[];
  ledgerEntries: LedgerEntry[];
  totalAmountPaidToSeller: number;
  totalAmountOwedToSellerFromPayments: number;
  pendingPaymentRecordsToSellerCount: number;
}

const sellerSchema = z.object({
  name: z.string().min(3, { message: "Seller/Company name must be at least 3 characters." }),
  contactPerson: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')), 
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }).regex(/^\d+[\d\s-]*$/, { message: "Phone number must contain valid characters (digits, spaces, hyphens)."}),
  address: z.string().optional(),
  gstin: z.string().optional().or(z.literal('')).refine(val => !val || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val), {
    message: "Invalid GSTIN format.", 
  }),
  bankDetails: z.string().optional(),
  purchaseTerms: z.string().optional(),
});

type SellerFormValues = z.infer<typeof sellerSchema>;

const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ITEMS_PER_PAGE_DETAILS_DIALOG = 50;

export default function ManageSellersPage() {
  const router = useRouter(); 
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [sellerToDelete, setSellerToDelete] = useState<Seller | null>(null);

  const [isDetailsViewOpen, setIsDetailsViewOpen] = useState(false);
  const [selectedSellerForDetails, setSelectedSellerForDetails] = useState<SellerDetailsView | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [ledgerEntriesCurrentPage, setLedgerEntriesCurrentPage] = useState(1);

  const { toast } = useToast();

  const form = useForm<SellerFormValues>({
    resolver: zodResolver(sellerSchema),
    defaultValues: { name: "", contactPerson: "", email: "", phone: "", address: "", gstin: "", bankDetails: "", purchaseTerms: "" },
  });

  const fetchSellers = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "sellers"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedSellers = querySnapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() } as Seller));
      setSellers(fetchedSellers);
    } catch (error: any) {
      toast({ title: "Database Error", description: "Could not load sellers. Ensure Firestore indexes are set.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchSellers(); }, [fetchSellers]);

  useEffect(() => {
    if (isFormDialogOpen) {
      if (editingSeller) form.reset(editingSeller);
      else form.reset({ name: "", contactPerson: "", email: "", phone: "", address: "", gstin: "", bankDetails: "", purchaseTerms: "" });
    }
  }, [editingSeller, isFormDialogOpen, form]);

  const handleFormSubmit = async (values: SellerFormValues) => {
    const dataToSave = {
      name: values.name,
      contactPerson: values.contactPerson || null,
      email: values.email || null,
      phone: values.phone,
      address: values.address || null,
      gstin: values.gstin || null,
      bankDetails: values.bankDetails || null,
      purchaseTerms: values.purchaseTerms || null,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingSeller) {
        await updateDoc(doc(db, "sellers", editingSeller.id), dataToSave);
        toast({ title: "Seller Updated", description: `Seller "${values.name}" updated.` });
      } else {
        await addDoc(collection(db, "sellers"), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: "Seller Added", description: `Seller "${values.name}" added.` });
      }
      fetchSellers(); setIsFormDialogOpen(false); setEditingSeller(null); form.reset();
    } catch (error: any) {
      toast({ title: "Save Error", description: `Failed to save seller: ${error.message}`, variant: "destructive" });
    }
  };

  const openAddDialog = () => { setEditingSeller(null); setIsFormDialogOpen(true); };
  const openEditDialog = (seller: Seller) => { setEditingSeller(seller); setIsFormDialogOpen(true); };
  const openDeleteDialog = (seller: Seller) => { setSellerToDelete(seller); setIsDeleteConfirmOpen(true); };

  const confirmDelete = async () => {
    if (!sellerToDelete) return;
    try {
      await deleteDoc(doc(db, "sellers", sellerToDelete.id));
      toast({ title: "Seller Deleted", description: `Seller "${sellerToDelete.name}" deleted.` });
      fetchSellers();
    } catch (error: any) {
      toast({ title: "Deletion Error", description: `Failed to delete seller: ${error.message}`, variant: "destructive" });
    } finally {
      setSellerToDelete(null); setIsDeleteConfirmOpen(false);
    }
  };

  const handleViewDetails = async (seller: Seller) => {
    setIsLoadingDetails(true);
    setIsDetailsViewOpen(true);
    setLedgerEntriesCurrentPage(1);
    try {
      const paymentsQuery = query(collection(db, "payments"), where("relatedEntityId", "==", seller.id), where("type", "==", "supplier"), orderBy("isoDate", "desc"));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const fetchedPayments = paymentsSnapshot.docs.map(d => ({ ...d.data(), id: d.id, displayAmountPaid: formatCurrency(d.data().amountPaid || 0) } as PaymentRecord));

      const ledgerEntriesQuery = query(collection(db, "ledgerEntries"), where("entityId", "==", seller.id), where("type", "==", "purchase"), orderBy("date", "desc"), orderBy("createdAt", "desc"));
      const ledgerSnapshot = await getDocs(ledgerEntriesQuery);
      const fetchedLedgerEntries = ledgerSnapshot.docs.map(d => ({ ...d.data(), id: d.id } as LedgerEntry));

      let totalPaidToSeller = 0;
      fetchedPayments.forEach(p => {
        if (p.status === 'Completed' || p.status === 'Sent' || p.status === 'Partial') {
            totalPaidToSeller += p.amountPaid;
        }
      });

      let totalOwedToSellerFromPayments = 0;
      let pendingPaymentRecordsToSellerCount = 0;
      fetchedPayments.forEach(p => {
        if ((p.status === 'Pending' || p.status === 'Partial') && p.remainingBalanceOnInvoice && p.remainingBalanceOnInvoice > 0) {
          totalOwedToSellerFromPayments += p.remainingBalanceOnInvoice;
          pendingPaymentRecordsToSellerCount++;
        }
      });

      setSelectedSellerForDetails({
        ...seller, payments: fetchedPayments, ledgerEntries: fetchedLedgerEntries,
        totalAmountPaidToSeller: totalPaidToSeller, 
        totalAmountOwedToSellerFromPayments: totalOwedToSellerFromPayments, 
        pendingPaymentRecordsToSellerCount: pendingPaymentRecordsToSellerCount,
      });
    } catch (error: any) {
      toast({ title: "Details Error", description: "Could not load seller details.", variant: "destructive" });
      setSelectedSellerForDetails(null); setIsDetailsViewOpen(false);
    } finally {
      setIsLoadingDetails(false);
    }
  };
  
  const handleGoToLedgerForPending = (sellerName: string) => {
    router.push(`/ledger?entityName=${encodeURIComponent(sellerName)}&paymentStatus=pending_partial&type=purchase`);
    setIsDetailsViewOpen(false);
  };

  const paginatedLedgerEntries = useMemo(() => {
    if (!selectedSellerForDetails) return [];
    const startIndex = (ledgerEntriesCurrentPage - 1) * ITEMS_PER_PAGE_DETAILS_DIALOG;
    const endIndex = startIndex + ITEMS_PER_PAGE_DETAILS_DIALOG;
    return selectedSellerForDetails.ledgerEntries.slice(startIndex, endIndex);
  }, [selectedSellerForDetails, ledgerEntriesCurrentPage]);

  const totalLedgerPages = selectedSellerForDetails ? Math.ceil(selectedSellerForDetails.ledgerEntries.length / ITEMS_PER_PAGE_DETAILS_DIALOG) : 0;

  const handleRecordOutgoingPayment = (seller: Seller) => {
    router.push(`/payments?type=supplier&entityId=${seller.id}&entityName=${encodeURIComponent(seller.name)}`);
  };

  const renderSellerFormFields = () => (
    <>
      <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Seller/Company Name</FormLabel><FormControl><Input placeholder="e.g., Acme Building Supplies Ltd." {...field} /></FormControl><FormMessage /></FormItem>)} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person (Optional)</FormLabel><FormControl><Input placeholder="e.g., Mr. Rajesh Kumar" {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Primary Phone Number</FormLabel><FormControl><Input placeholder="e.g., 9876543210" {...field} /></FormControl><FormMessage /></FormItem>)} />
      </div>
      <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address (Optional)</FormLabel><FormControl><Input type="email" placeholder="e.g., contact@acmesupplies.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
      <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Full Address (Optional)</FormLabel><FormControl><Textarea placeholder="Enter complete address of the seller/supplier" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
      <FormField control={form.control} name="gstin" render={({ field }) => (<FormItem><FormLabel>GSTIN (Optional)</FormLabel><FormControl><Input placeholder="Seller's GST Identification Number (if applicable)" {...field} /></FormControl><FormMessage /></FormItem>)} />
      <FormField control={form.control} name="bankDetails" render={({ field }) => (<FormItem><FormLabel>Bank Details (Optional, for payments)</FormLabel><FormControl><Textarea placeholder="e.g., Account Name, Account Number, Bank Name, IFSC Code" {...field} rows={3}/></FormControl><FormMessage /></FormItem>)} />
      <FormField control={form.control} name="purchaseTerms" render={({ field }) => (<FormItem><FormLabel>Standard Purchase Terms (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., Net 30 days, Payment on delivery, 50% advance" {...field} rows={2}/></FormControl><FormMessage /></FormItem>)} />
    </>
  );

  if (isLoading && sellers.length === 0) return <PageHeader title="Manage Sellers/Suppliers" description="Loading seller data..." icon={Truck} />;

  return (
    <>
      <PageHeader title="Manage Sellers/Suppliers" description="Administer seller accounts. (Admin Only)" icon={Truck} actions={<Button onClick={openAddDialog} className="mt-4 sm:mt-0"><PlusCircle className="mr-2 h-4 w-4" />Add New Seller</Button>} />
      <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) { setIsFormDialogOpen(false); setEditingSeller(null); form.reset(); } else { setIsFormDialogOpen(isOpen); }}}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editingSeller ? `Edit Seller: ${editingSeller.name}` : "Add New Seller"}</DialogTitle><DialogDescription>{editingSeller ? "Update details." : "Enter details."}</DialogDescription></DialogHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-4">{renderSellerFormFields()}
            <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 border-t -mx-6 px-6 flex flex-col sm:flex-row gap-2"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : "Save"}</Button></DialogFooter>
          </form></Form></DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setSellerToDelete(null); setIsDeleteConfirmOpen(isOpen);}}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>Delete seller &quot;{sellerToDelete?.name}&quot;?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <Dialog open={isDetailsViewOpen} onOpenChange={(isOpen) => { if(!isOpen) setSelectedSellerForDetails(null); setIsDetailsViewOpen(isOpen); }}>
        <DialogContent className="max-w-3xl w-[95vw] h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>Seller Details: {selectedSellerForDetails?.name}</DialogTitle><DialogDescription>Comprehensive overview of seller activity and financials.</DialogDescription></DialogHeader>
            {isLoadingDetails ? (<div className="flex-grow flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading details...</span></div>)
            : selectedSellerForDetails ? (
            <ScrollArea className="flex-grow pr-2 -mr-2">
                <div className="space-y-6 py-2 overflow-x-auto">
                <Card><CardHeader><CardTitle className="text-lg">Financial Summary</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div><p className="text-muted-foreground">Total Paid (to Seller):</p><p className="font-semibold text-green-600">{formatCurrency(selectedSellerForDetails.totalAmountPaidToSeller)}</p></div>
                        <div><p className="text-muted-foreground">Total Owed (to Seller from Payments):</p><p className="font-semibold text-red-600">{formatCurrency(selectedSellerForDetails.totalAmountOwedToSellerFromPayments)}</p></div>
                        <Button variant="link" size="sm" className="p-0 h-auto justify-start text-left" onClick={() => handleGoToLedgerForPending(selectedSellerForDetails.name)}>
                            <div><p className="text-muted-foreground">Pending/Partial Payment Records:</p><p className="font-semibold text-blue-600">{selectedSellerForDetails.pendingPaymentRecordsToSellerCount} (View Related Ledger)</p></div>
                        </Button>
                    </CardContent>
                </Card>
                <Card><CardHeader><CardTitle className="text-lg">Payment History ({selectedSellerForDetails.payments.length})</CardTitle></CardHeader>
                    <CardContent>
                        {selectedSellerForDetails.payments.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table className="text-xs min-w-[600px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead>Ref ID</TableHead></TableRow></TableHeader>
                            <TableBody>{selectedSellerForDetails.payments.slice(0,5).map(p => (<TableRow key={p.id}><TableCell>{p.date}</TableCell><TableCell>{p.displayAmountPaid}</TableCell><TableCell>{p.method || 'N/A'}</TableCell><TableCell><Badge variant={p.status === "Completed" || p.status === "Sent" ? "default" : "secondary"}>{p.status}</Badge></TableCell><TableCell>{p.relatedInvoiceId || p.ledgerEntryId || 'N/A'}</TableCell></TableRow>))}
                            </TableBody></Table>
                        </div>
                        ) : (<p className="text-sm text-muted-foreground">No payment records found.</p>)}
                        {selectedSellerForDetails.payments.length > 5 && <p className="text-xs text-muted-foreground mt-2 text-center">Showing last 5 payments. Full history in Payments section.</p>}
                    </CardContent>
                </Card>
                <Card><CardHeader><CardTitle className="text-lg">Ledger Entries (Purchases) ({selectedSellerForDetails.ledgerEntries.length})</CardTitle></CardHeader>
                    <CardContent>
                        {selectedSellerForDetails.ledgerEntries.length > 0 ? (<>
                        <div className="overflow-x-auto">
                        <Table className="text-xs min-w-[600px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Pymt Status</TableHead></TableRow></TableHeader>
                        <TableBody>{paginatedLedgerEntries.map(le => (<TableRow key={le.id}><TableCell>{le.date}</TableCell><TableCell>{le.items.map(i => i.productName).join(', ').substring(0,30)}...</TableCell><TableCell className="text-right">{formatCurrency(le.grandTotal)}</TableCell><TableCell><Badge variant={le.paymentStatus === 'paid' ? 'default' : (le.paymentStatus === 'partial' ? 'outline' : 'secondary')}>{le.paymentStatus}</Badge></TableCell></TableRow>))}
                        </TableBody></Table>
                        </div>
                        {totalLedgerPages > 1 && (<div className="flex justify-center items-center gap-2 mt-4"><Button variant="outline" size="sm" onClick={() => setLedgerEntriesCurrentPage(p => Math.max(1, p-1))} disabled={ledgerEntriesCurrentPage === 1}>Prev</Button><span className="text-xs text-muted-foreground">Page {ledgerEntriesCurrentPage} of {totalLedgerPages}</span><Button variant="outline" size="sm" onClick={() => setLedgerEntriesCurrentPage(p => Math.min(totalLedgerPages, p+1))} disabled={ledgerEntriesCurrentPage === totalLedgerPages}>Next</Button></div>)}
                        </>) : (<p className="text-sm text-muted-foreground">No purchase ledger entries found.</p>)}
                    </CardContent>
                </Card>
            </div></ScrollArea>
            ) : (<div className="flex-grow flex items-center justify-center"><p className="text-muted-foreground">No seller selected or details not found.</p></div>)}
            <DialogFooter className="pt-4 mt-auto border-t"><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="shadow-lg rounded-xl"><CardHeader><CardTitle className="font-headline text-foreground">Seller/Supplier List</CardTitle><CardDescription>All registered sellers from Firestore.</CardDescription></CardHeader>
        <CardContent>
          {isLoading && sellers.length === 0 ? (<div className="text-center py-10 text-muted-foreground">Loading sellers...</div>)
           : !isLoading && sellers.length === 0 ? (<div className="flex flex-col items-center justify-center py-10 text-center"><FileWarning className="h-16 w-16 text-muted-foreground mb-4" /><p className="text-xl font-semibold text-muted-foreground">No Sellers Found</p><p className="text-sm text-muted-foreground mb-6">Add your first seller.</p><Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Add New Seller</Button></div>)
           : (
            <>
              <div className="hidden lg:block">
                <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Phone</TableHead><TableHead>GSTIN</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>{sellers.map((seller) => (<TableRow key={seller.id}><TableCell className="font-medium">{seller.name}</TableCell><TableCell>{seller.contactPerson || "N/A"}</TableCell><TableCell>{seller.phone}</TableCell><TableCell>{seller.gstin || "N/A"}</TableCell>
                        <TableCell className="text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewDetails(seller)}><Eye className="mr-2 h-4 w-4" />View Full Details</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditDialog(seller)}><Edit className="mr-2 h-4 w-4" />Edit Details</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleRecordOutgoingPayment(seller)}><Banknote className="mr-2 h-4 w-4" />Record Payment</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDeleteDialog(seller)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" />Delete Seller</DropdownMenuItem>
                            </DropdownMenuContent></DropdownMenu></TableCell></TableRow>))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
                {sellers.map(seller => (
                  <Card key={seller.id + '-mobile'}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-base">{seller.name}</CardTitle>
                      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(seller)}><Eye className="mr-2 h-4 w-4" />View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(seller)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRecordOutgoingPayment(seller)}><Banknote className="mr-2 h-4 w-4" />Record Payment</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openDeleteDialog(seller)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <p className="text-muted-foreground">{seller.contactPerson || 'No contact person'}</p>
                      <p className="font-medium">{seller.phone}</p>
                      {seller.gstin && <p className="text-xs text-muted-foreground">GSTIN: {seller.gstin}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
