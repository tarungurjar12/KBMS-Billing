
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Truck, PlusCircle, MoreHorizontal, Edit, Trash2, Eye, Banknote, FileWarning } from "lucide-react";
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
import { useRouter } from 'next/navigation'; 

/**
 * @fileOverview Page for Admin to manage Seller/Supplier accounts in Firestore.
 * This module is strictly Admin-only.
 * Allows Admin to perform full CRUD operations on sellers.
 * Data is fetched from and saved to Firebase Firestore.
 */

/**
 * Interface representing a Seller/Supplier document in Firestore.
 */
export interface Seller {
  id: string; // Firestore document ID
  name: string; // Name of the seller/supplier company
  contactPerson?: string; // Optional: Primary contact person at the seller
  email?: string; // Optional: Seller's email address
  phone: string; // Seller's phone number
  address?: string; // Optional: Seller's physical address
  gstin?: string; // Optional: Seller's GST Identification Number
  bankDetails?: string; // Optional: Seller's bank account details
  purchaseTerms?: string; // Optional: Agreed purchase terms
  createdAt?: Timestamp; 
  updatedAt?: Timestamp; 
}

// Zod schema for seller form validation
const sellerSchema = z.object({
  name: z.string().min(3, { message: "Seller/Company name must be at least 3 characters." }),
  contactPerson: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')), 
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }).regex(/^\d+[\d\s-]*$/, { message: "Phone number must contain valid characters (digits, spaces, hyphens)."}),
  address: z.string().optional(),
  gstin: z.string().optional().refine(val => !val || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val), {
    message: "Invalid GSTIN format.", 
  }),
  bankDetails: z.string().optional(),
  purchaseTerms: z.string().optional(),
});

type SellerFormValues = z.infer<typeof sellerSchema>;

/**
 * ManageSellersPage component.
 * Provides UI and logic for Admin to manage seller/supplier data in Firestore.
 * Handles CRUD operations, dialogs for add/edit, and form validation.
 * @returns {JSX.Element} The rendered manage sellers page.
 */
export default function ManageSellersPage() {
  const router = useRouter(); 
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [sellerToDelete, setSellerToDelete] = useState<Seller | null>(null);

  const { toast } = useToast();

  // React Hook Form setup
  const form = useForm<SellerFormValues>({
    resolver: zodResolver(sellerSchema),
    defaultValues: { name: "", contactPerson: "", email: "", phone: "", address: "", gstin: "", bankDetails: "", purchaseTerms: "" },
  });

  /**
   * Fetches seller list from Firestore, ordered by name.
   */
  const fetchSellers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Firestore Index Required: 'sellers' collection, orderBy 'name' (ASC)
      const q = query(collection(db, "sellers"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedSellers = querySnapshot.docs.map(docSnapshot => ({ id: docSnapshot.id, ...docSnapshot.data() } as Seller));
      setSellers(fetchedSellers);
    } catch (error: any) {
      console.error("Error fetching sellers: ", error);
      if (error.code === 'failed-precondition') {
         toast({
            title: "Database Index Required",
            description: `A query for sellers failed. Please create the required Firestore index for 'sellers' collection (orderBy 'name' ascending). Check your browser's developer console for a Firebase link to create it, or visit the Firestore indexes page in your Firebase console.`,
            variant: "destructive",
            duration: 15000,
        });
      } else {
        toast({ title: "Database Error", description: "Could not load sellers from the database. Please try again.", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  // Effect to reset form when editingSeller or dialog state changes
  useEffect(() => {
    if (isFormDialogOpen) {
      if (editingSeller) {
        form.reset(editingSeller);
      } else { 
        form.reset({ name: "", contactPerson: "", email: "", phone: "", address: "", gstin: "", bankDetails: "", purchaseTerms: "" });
      }
    }
  }, [editingSeller, isFormDialogOpen, form]);

  /**
   * Handles submission of the seller form (for both add and edit).
   * Saves or updates the seller data in Firestore.
   * @param {SellerFormValues} values - The validated form values.
   */
  const handleFormSubmit = async (values: SellerFormValues) => {
    try {
      const dataToSave = { ...values, email: values.email || "" }; 
      if (editingSeller) { 
        const sellerRef = doc(db, "sellers", editingSeller.id);
        await updateDoc(sellerRef, {...dataToSave, updatedAt: serverTimestamp()});
        toast({ title: "Seller Updated", description: `Seller "${values.name}" has been updated successfully.` });
      } else { 
        await addDoc(collection(db, "sellers"), {...dataToSave, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
        toast({ title: "Seller Added", description: `New seller "${values.name}" has been added successfully.` });
      }
      fetchSellers(); 
      setIsFormDialogOpen(false); 
      setEditingSeller(null); 
      form.reset(); 
    } catch (error: any) {
      console.error("Error saving seller: ", error);
      toast({ title: "Save Error", description: "Failed to save seller to the database. Please try again.", variant: "destructive" });
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
      toast({ title: "Seller Deleted", description: `Seller "${sellerToDelete.name}" has been deleted successfully.`, variant: "default" });
      fetchSellers(); 
    } catch (error: any) {
      console.error("Error deleting seller: ", error);
      toast({ title: "Deletion Error", description: "Failed to delete seller from the database. Please try again.", variant: "destructive" });
    } finally {
      setSellerToDelete(null);
      setIsDeleteConfirmOpen(false); 
    }
  };
  
  const handleViewPurchaseHistory = (seller: Seller) => {
    toast({ title: "View Purchase History (Placeholder)", description: `Functionality to view purchase history for ${seller.name} is planned for a future update.` });
  };
  
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

  if (isLoading) {
    return <PageHeader title="Manage Sellers/Suppliers" description="Loading seller data from database..." icon={Truck} />;
  }

  return (
    <>
      <PageHeader 
        title="Manage Sellers/Suppliers" 
        description="Administer seller and supplier accounts and their information. (Admin Only)" 
        icon={Truck} 
        actions={<Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Add New Seller/Supplier</Button>} 
      />

      <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { 
          if(!isOpen) { 
            setIsFormDialogOpen(false); 
            setEditingSeller(null); 
            form.reset(); 
          } else { 
            setIsFormDialogOpen(isOpen); 
          }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSeller ? `Edit Seller: ${editingSeller.name}` : "Add New Seller/Supplier"}</DialogTitle>
            <DialogDescription>
              {editingSeller ? "Update the details for this seller." : "Enter the details for the new seller or supplier."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-4">
              {renderSellerFormFields()}
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 border-t -mx-6 px-6"> 
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (editingSeller ? "Saving..." : "Adding...") : (editingSeller ? "Save Changes" : "Add Seller")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setSellerToDelete(null); setIsDeleteConfirmOpen(isOpen);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the seller &quot;{sellerToDelete?.name}&quot; from the database.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setIsDeleteConfirmOpen(false); setSellerToDelete(null);}}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete Seller</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Seller/Supplier List</CardTitle>
          <CardDescription>A list of all registered sellers and suppliers from Firestore, ordered by name.</CardDescription>
        </CardHeader>
        <CardContent>
          {sellers.length > 0 ? (
            <Table>
                <TableHeader><TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Contact Person</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="hidden md:table-cell">GSTIN</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                    {sellers.map((seller) => (
                        <TableRow key={seller.id}>
                            <TableCell className="font-medium">{seller.name}</TableCell>
                            <TableCell className="hidden sm:table-cell">{seller.contactPerson || "N/A"}</TableCell>
                            <TableCell>{seller.phone}</TableCell>
                            <TableCell className="hidden md:table-cell">{seller.gstin || "N/A"}</TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Actions for {seller.name}</span></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openEditDialog(seller)}><Edit className="mr-2 h-4 w-4" />Edit Details</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleViewPurchaseHistory(seller)}><Eye className="mr-2 h-4 w-4" />View Purchase History</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleRecordOutgoingPayment(seller)}><Banknote className="mr-2 h-4 w-4" />Record Outgoing Payment</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openDeleteDialog(seller)} className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground">
                                            <Trash2 className="mr-2 h-4 w-4" />Delete Seller
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <FileWarning className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-xl font-semibold text-muted-foreground">No Sellers Found</p>
                <p className="text-sm text-muted-foreground mb-6">Add your first seller or supplier to the database.</p>
                <Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Add New Seller/Supplier</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
