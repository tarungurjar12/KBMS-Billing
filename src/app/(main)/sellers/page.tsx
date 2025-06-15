
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Truck, PlusCircle, MoreHorizontal, Edit, Trash2, Eye, Banknote } from "lucide-react";
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
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';

/**
 * @fileOverview Page for Admin to manage Seller/Supplier accounts in Firestore.
 * This module is strictly Admin-only.
 * Allows Admin to perform full CRUD operations on sellers.
 */

export interface Seller {
  id: string; // Firestore document ID
  name: string;
  contactPerson?: string;
  email?: string;
  phone: string;
  address?: string;
  gstin?: string;
  bankDetails?: string; // Sensitive, store securely
  purchaseTerms?: string;
  createdAt?: Timestamp; // Firestore Timestamp
  // Future: purchasePriceHistory (subcollection), notes
}

// Zod schema for seller form validation
const sellerSchema = z.object({
  name: z.string().min(3, { message: "Seller name must be at least 3 characters." }),
  contactPerson: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }).regex(/^\d+[\d\s-]*$/, { message: "Phone number must contain valid characters."}),
  address: z.string().optional(),
  gstin: z.string().optional(), // Future: Add specific GSTIN validation if needed
  bankDetails: z.string().optional(),
  purchaseTerms: z.string().optional(),
});

type SellerFormValues = z.infer<typeof sellerSchema>;

/**
 * ManageSellersPage component.
 * Provides UI and logic for Admin to manage seller/supplier data in Firestore.
 * @returns {JSX.Element} The rendered manage sellers page.
 */
export default function ManageSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [sellerToDelete, setSellerToDelete] = useState<Seller | null>(null);

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
    } catch (error) {
      console.error("Error fetching sellers: ", error);
      toast({ title: "Error", description: "Could not load sellers from database.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  useEffect(() => {
    if (editingSeller && isFormDialogOpen) {
      form.reset(editingSeller);
    } else {
      form.reset({ name: "", contactPerson: "", email: "", phone: "", address: "", gstin: "", bankDetails: "", purchaseTerms: "" });
    }
  }, [editingSeller, isFormDialogOpen, form]);

  const handleFormSubmit = async (values: SellerFormValues) => {
    try {
      const dataToSave = { ...values, email: values.email || "", createdAt: serverTimestamp() };
      if (editingSeller) {
        const sellerRef = doc(db, "sellers", editingSeller.id);
        await updateDoc(sellerRef, dataToSave);
        toast({ title: "Seller Updated", description: `${values.name} updated in Firestore.` });
      } else {
        await addDoc(collection(db, "sellers"), dataToSave);
        toast({ title: "Seller Added", description: `${values.name} added to Firestore.` });
      }
      fetchSellers();
      setIsFormDialogOpen(false);
      setEditingSeller(null);
    } catch (error) {
      console.error("Error saving seller: ", error);
      toast({ title: "Error", description: "Failed to save seller to database.", variant: "destructive" });
    }
  };

  const openAddDialog = () => {
    setEditingSeller(null);
    setIsFormDialogOpen(true);
  };
  
  const openEditDialog = (seller: Seller) => {
    setEditingSeller(seller);
    setIsFormDialogOpen(true);
  };

  const openDeleteDialog = (seller: Seller) => {
    setSellerToDelete(seller);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!sellerToDelete) return;
    try {
      await deleteDoc(doc(db, "sellers", sellerToDelete.id));
      toast({ title: "Seller Deleted", description: `${sellerToDelete.name} deleted from Firestore.`, variant: "default" });
      fetchSellers();
      setSellerToDelete(null);
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      console.error("Error deleting seller: ", error);
      toast({ title: "Error", description: "Failed to delete seller from database.", variant: "destructive" });
    }
  };
  
  const handleViewPurchaseHistory = (seller: Seller) => {
    toast({ title: "View Purchase History (Placeholder)", description: `Purchase history for ${seller.name} to be implemented.` });
  };
  
  const handleRecordOutgoingPayment = (seller: Seller) => {
     // This could navigate to the Payments page with pre-filled seller info, or open a dedicated dialog.
    router.push(`/payments?type=supplier&entityId=${seller.id}&entityName=${encodeURIComponent(seller.name)}`);
    toast({ title: "Record Outgoing Payment", description: `Navigating to record payment for ${seller.name}.` });
  };

  const renderSellerFormFields = () => (
    <>
      <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Seller/Company Name</FormLabel><FormControl><Input placeholder="e.g., Acme Supplies Ltd." {...field} /></FormControl><FormMessage /></FormItem>)} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person (Optional)</FormLabel><FormControl><Input placeholder="e.g., Rajesh Kumar" {...field} /></FormControl><FormMessage /></FormItem>)} />
        <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="e.g., 9876543210" {...field} /></FormControl><FormMessage /></FormItem>)} />
      </div>
      <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email (Optional)</FormLabel><FormControl><Input type="email" placeholder="e.g., contact@acme.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
      <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address (Optional)</FormLabel><FormControl><Textarea placeholder="Full address of the seller" {...field} /></FormControl><FormMessage /></FormItem>)} />
      <FormField control={form.control} name="gstin" render={({ field }) => (<FormItem><FormLabel>GSTIN (Optional)</FormLabel><FormControl><Input placeholder="Seller's GST Identification Number" {...field} /></FormControl><FormMessage /></FormItem>)} />
      <FormField control={form.control} name="bankDetails" render={({ field }) => (<FormItem><FormLabel>Bank Details (Optional, Sensitive)</FormLabel><FormControl><Textarea placeholder="e.g., Account Name, Number, Bank, IFSC" {...field} /></FormControl><FormMessage /></FormItem>)} />
      <FormField control={form.control} name="purchaseTerms" render={({ field }) => (<FormItem><FormLabel>Purchase Terms (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., Net 30, Payment on delivery" {...field} /></FormControl><FormMessage /></FormItem>)} />
    </>
  );

  const router = useRouter(); // Initialize router for navigation

  if (isLoading) {
    return <PageHeader title="Manage Sellers" description="Loading seller data from database..." icon={Truck} />;
  }

  return (
    <>
      <PageHeader title="Manage Sellers" description="Administer seller/supplier accounts and information. (Admin Only)" icon={Truck} actions={<Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Add New Seller</Button>} />

      <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) { setIsFormDialogOpen(false); setEditingSeller(null); form.reset(); } else { setIsFormDialogOpen(isOpen); }}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingSeller ? "Edit Seller: " + editingSeller.name : "Add New Seller/Supplier"}</DialogTitle><DialogDescription>Enter the details for the seller.</DialogDescription></DialogHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">{renderSellerFormFields()}<DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit">{editingSeller ? "Save Changes" : "Add Seller"}</Button></DialogFooter></form></Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setSellerToDelete(null); setIsDeleteConfirmOpen(isOpen);}}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{sellerToDelete?.name}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => {setIsDeleteConfirmOpen(false); setSellerToDelete(null);}}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete Seller</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <Card className="shadow-lg rounded-xl">
        <CardHeader><CardTitle className="font-headline text-foreground">Seller List</CardTitle><CardDescription>A list of all registered sellers/suppliers from Firestore.</CardDescription></CardHeader>
        <CardContent>
          {sellers.length > 0 ? (
            <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Phone</TableHead><TableHead>GSTIN</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                    {sellers.map((seller) => (
                        <TableRow key={seller.id}>
                            <TableCell className="font-medium">{seller.name}</TableCell><TableCell>{seller.contactPerson || "-"}</TableCell><TableCell>{seller.phone}</TableCell><TableCell>{seller.gstin || "-"}</TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Actions</span></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openEditDialog(seller)}><Edit className="mr-2 h-4 w-4" />Edit Details</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleViewPurchaseHistory(seller)}><Eye className="mr-2 h-4 w-4" />Purchase History</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleRecordOutgoingPayment(seller)}><Banknote className="mr-2 h-4 w-4" />Record Payment</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openDeleteDialog(seller)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete Seller</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          ) : (<div className="text-center py-8 text-muted-foreground">No sellers found.</div>)}
        </CardContent>
      </Card>
    </>
  );
}
