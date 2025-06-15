
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Truck, PlusCircle, MoreHorizontal, Edit, Trash2, Eye, Banknote } from "lucide-react"; // Added Banknote
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
// Future: Import Firebase functions for Firestore operations
// import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
// import { db } from '@/lib/firebase/firebaseConfig';

/**
 * @fileOverview Page for Admin to manage Seller/Supplier accounts.
 * This module is strictly Admin-only.
 * Allows Admin to perform full CRUD operations on sellers, including sensitive details
 * like bank information and purchase terms.
 * Store Managers are completely blocked from accessing this module.
 */

interface Seller {
  id: string; // Firestore document ID or unique local ID
  name: string;
  contactPerson?: string;
  email?: string;
  phone: string;
  address?: string;
  gstin?: string;
  bankDetails?: string; // Sensitive, store securely if possible (e.g., encrypted or restricted access in Firestore rules)
  purchaseTerms?: string;
  // Future: purchasePriceHistory (subcollection or array of objects), notes, createdAt
}

// Initial dummy data. This will be replaced by Firestore data in Phase 2.
const initialSellers: Seller[] = [
    {id: "SELL-LOCAL-001", name: "Acme Building Supplies", contactPerson: "Rohan Patel", email: "rohan@acmebs.com", phone: "9876543210", address: "123 Industrial Area, Mumbai", gstin: "27AXYZS1234B1Z5", bankDetails: "HDFC A/C XXXXXX, IFSC HDFC000123", purchaseTerms: "Net 30"},
    {id: "SELL-LOCAL-002", name: "Bharat Hardware Co.", contactPerson: "Priya Singh", email: "priya.singh@bharathardware.com", phone: "8765432109", address: "45 Market Road, Delhi", gstin: "07BCHCS5678A1Z2", bankDetails: "ICICI A/C YYYYYY, IFSC ICIC000456", purchaseTerms: "Payment on Delivery"},
];

// Zod schema for seller form validation
const sellerSchema = z.object({
  name: z.string().min(3, { message: "Seller name must be at least 3 characters." }),
  contactPerson: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }).regex(/^\d+$/, { message: "Phone number must contain only digits."}),
  address: z.string().optional(),
  gstin: z.string().optional(), // Future: Add specific GSTIN validation
  bankDetails: z.string().optional(),
  purchaseTerms: z.string().optional(),
});

type SellerFormValues = z.infer<typeof sellerSchema>;

/**
 * ManageSellersPage component.
 * Provides UI and logic for Admin to manage seller/supplier data.
 */
export default function ManageSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddSellerDialogOpen, setIsAddSellerDialogOpen] = useState(false);
  const [isEditSellerDialogOpen, setIsEditSellerDialogOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [sellerToDelete, setSellerToDelete] = useState<Seller | null>(null);

  const { toast } = useToast();

  const form = useForm<SellerFormValues>({
    resolver: zodResolver(sellerSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      gstin: "",
      bankDetails: "",
      purchaseTerms: "",
    },
  });

  // Effect to load sellers (currently from initial data, future from Firestore)
  useEffect(() => {
    // Future: Fetch sellers from Firestore
    // const fetchSellers = async () => {
    //   setIsLoading(true);
    //   try {
    //     const querySnapshot = await getDocs(collection(db, "sellers"));
    //     const fetchedSellers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Seller));
    //     setSellers(fetchedSellers);
    //   } catch (error) {
    //     console.error("Error fetching sellers: ", error);
    //     toast({ title: "Error", description: "Could not load sellers.", variant: "destructive" });
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    // fetchSellers();

    // Phase 1: Use local data
    setSellers(initialSellers);
    setIsLoading(false);
  }, [toast]);

  // Effect to reset form when edit dialog opens/closes or editingSeller changes
  useEffect(() => {
    if (editingSeller && isEditSellerDialogOpen) {
      form.reset(editingSeller);
    } else {
      form.reset({ name: "", contactPerson: "", email: "", phone: "", address: "", gstin: "", bankDetails: "", purchaseTerms: "" });
    }
  }, [editingSeller, isEditSellerDialogOpen, form]);

  /**
   * Handles submission of the "Add New Seller" form.
   * Phase 1: Adds to local state.
   * Future: Adds seller to Firestore.
   */
  const handleAddSubmit = (values: SellerFormValues) => {
    // Future: Firebase integration
    // try {
    //   const newSellerData = { ...values, createdAt: serverTimestamp() };
    //   const docRef = await addDoc(collection(db, "sellers"), newSellerData);
    //   setSellers((prev) => [{ id: docRef.id, ...newSellerData }, ...prev]);
    // } catch (error) {
    //   console.error("Error adding seller: ", error);
    //   toast({ title: "Error", description: "Failed to add seller.", variant: "destructive" });
    //   return;
    // }

    // Phase 1: Local state update
    const newSeller: Seller = {
      id: `SELL-LOCAL-${Date.now()}`,
      ...values,
    };
    setSellers((prev) => [newSeller, ...prev]);
    toast({ title: "Seller Added (Locally)", description: `${values.name} has been added.` });
    form.reset();
    setIsAddSellerDialogOpen(false);
  };

  /**
   * Handles submission of the "Edit Seller" form.
   * Phase 1: Updates local state.
   * Future: Updates seller in Firestore.
   */
  const handleEditSubmit = (values: SellerFormValues) => {
    if (!editingSeller) return;
    // Future: Firebase integration
    // try {
    //   const sellerRef = doc(db, "sellers", editingSeller.id);
    //   await updateDoc(sellerRef, values);
    //   setSellers((prev) => prev.map((s) => (s.id === editingSeller.id ? { ...s, ...values } : s)));
    // } catch (error) {
    //   console.error("Error updating seller: ", error);
    //   toast({ title: "Error", description: "Failed to update seller.", variant: "destructive" });
    //   return;
    // }

    // Phase 1: Local state update
    const updatedSeller = { ...editingSeller, ...values };
    setSellers((prev) => prev.map((s) => (s.id === editingSeller.id ? updatedSeller : s)));
    toast({ title: "Seller Updated (Locally)", description: `${values.name} has been updated.` });
    setEditingSeller(null);
    setIsEditSellerDialogOpen(false);
    form.reset();
  };

  /**
   * Opens the edit dialog and populates form with seller data.
   */
  const openEditDialog = (seller: Seller) => {
    setEditingSeller(seller);
    setIsEditSellerDialogOpen(true);
  };

  /**
   * Opens the delete confirmation dialog.
   */
  const openDeleteDialog = (seller: Seller) => {
    setSellerToDelete(seller);
    setIsDeleteConfirmOpen(true);
  };

  /**
   * Confirms and performs seller deletion.
   * Phase 1: Removes from local state.
   * Future: Deletes seller from Firestore.
   */
  const confirmDelete = () => {
    if (!sellerToDelete) return;
    // Future: Firebase integration
    // try {
    //   await deleteDoc(doc(db, "sellers", sellerToDelete.id));
    //   setSellers((prev) => prev.filter((s) => s.id !== sellerToDelete.id));
    // } catch (error) {
    //   console.error("Error deleting seller: ", error);
    //   toast({ title: "Error", description: "Failed to delete seller.", variant: "destructive" });
    //   return;
    // }

    // Phase 1: Local state update
    setSellers((prev) => prev.filter((s) => s.id !== sellerToDelete.id));
    toast({ title: "Seller Deleted (Locally)", description: `${sellerToDelete.name} has been deleted.`, variant: "destructive" });
    setSellerToDelete(null);
    setIsDeleteConfirmOpen(false);
  };
  
  /**
   * Placeholder for viewing purchase price history for a seller.
   */
  const handleViewPurchaseHistory = (seller: Seller) => {
    toast({
      title: "View Purchase History (Placeholder)",
      description: `Functionality to view purchase price history from ${seller.name} to be implemented. This would track product purchase prices over time.`
    });
  };
  
  /**
   * Placeholder for recording an outgoing payment to a seller.
   */
  const handleRecordOutgoingPayment = (seller: Seller) => {
    toast({
      title: "Record Outgoing Payment (Placeholder)",
      description: `Functionality to record an outgoing payment to ${seller.name} to be implemented. This would be part of the Payment Management Module (Admin only).`
    });
  };

  /**
   * Renders the common form fields for adding or editing a seller.
   * @returns JSX.Element
   */
  const renderSellerFormFields = () => (
    <>
      <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Seller/Company Name</FormLabel>
            <FormControl><Input placeholder="e.g., Acme Supplies Ltd." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={form.control} name="contactPerson" render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Person (Optional)</FormLabel>
              <FormControl><Input placeholder="e.g., Rajesh Kumar" {...field} /></FormControl>
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
      </div>
      <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email (Optional)</FormLabel>
            <FormControl><Input type="email" placeholder="e.g., contact@acme.com" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField control={form.control} name="address" render={({ field }) => (
          <FormItem>
            <FormLabel>Address (Optional)</FormLabel>
            <FormControl><Textarea placeholder="Full address of the seller" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField control={form.control} name="gstin" render={({ field }) => (
          <FormItem>
            <FormLabel>GSTIN (Optional)</FormLabel>
            <FormControl><Input placeholder="Seller's GST Identification Number" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField control={form.control} name="bankDetails" render={({ field }) => (
          <FormItem>
            <FormLabel>Bank Details (Optional, Sensitive)</FormLabel>
            <FormControl><Textarea placeholder="e.g., Account Name, Number, Bank, IFSC" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField control={form.control} name="purchaseTerms" render={({ field }) => (
          <FormItem>
            <FormLabel>Purchase Terms (Optional)</FormLabel>
            <FormControl><Textarea placeholder="e.g., Net 30, Payment on delivery" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );

  if (isLoading) {
    return <PageHeader title="Manage Sellers" description="Loading seller data..." icon={Truck} />;
  }

  return (
    <>
      <PageHeader
        title="Manage Sellers"
        description="Administer seller/supplier accounts and information. (Admin Only)"
        icon={Truck}
        actions={
          <Button onClick={() => { form.reset(); setIsAddSellerDialogOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Seller
          </Button>
        }
      />

      {/* Add Seller Dialog */}
      <Dialog open={isAddSellerDialogOpen} onOpenChange={(isOpen) => { setIsAddSellerDialogOpen(isOpen); if(!isOpen) form.reset(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add New Seller/Supplier</DialogTitle><DialogDescription>Enter the details for the new seller.</DialogDescription></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
              {renderSellerFormFields()}
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit">Add Seller</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Seller Dialog */}
      <Dialog open={isEditSellerDialogOpen} onOpenChange={(isOpen) => { setIsEditSellerDialogOpen(isOpen); if(!isOpen) setEditingSeller(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit Seller: {editingSeller?.name}</DialogTitle><DialogDescription>Update the details for this seller.</DialogDescription></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
              {renderSellerFormFields()}
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit">Save Changes</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Seller Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setSellerToDelete(null); setIsDeleteConfirmOpen(isOpen);}}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{sellerToDelete?.name}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => {setIsDeleteConfirmOpen(false); setSellerToDelete(null);}}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete Seller</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Seller List</CardTitle>
          <CardDescription>A list of all registered sellers/suppliers.</CardDescription>
        </CardHeader>
        <CardContent>
          {sellers.length > 0 ? (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>GSTIN</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sellers.map((seller) => (
                        <TableRow key={seller.id}>
                            <TableCell className="font-medium">{seller.name}</TableCell>
                            <TableCell>{seller.contactPerson || "-"}</TableCell>
                            <TableCell>{seller.phone}</TableCell>
                            <TableCell>{seller.gstin || "-"}</TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Actions for {seller.name}</span></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openEditDialog(seller)}><Edit className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleViewPurchaseHistory(seller)}>
                                           <Eye className="mr-2 h-4 w-4" /> View Purchase History
                                        </DropdownMenuItem>
                                         <DropdownMenuItem onClick={() => handleRecordOutgoingPayment(seller)}>
                                           <Banknote className="mr-2 h-4 w-4" /> Record Outgoing Payment
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openDeleteDialog(seller)} className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground"><Trash2 className="mr-2 h-4 w-4" /> Delete Seller</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          ) : (
            <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-md">
                <p className="text-muted-foreground">No sellers found. Click "Add New Seller" to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>
      {/* 
        Phase 1 Data Storage: Seller data is stored in local component state.
        Phase 2 (Future-Ready):
        - Seller data will be stored in a 'sellers' collection in Firebase Firestore.
        - Firestore Security Rules will strictly limit access to Admins only for this collection.
        - Fields would include: name, contactPerson, email, phone, address, gstin, bankDetails (consider encryption or subcollection with tighter rules), purchaseTerms, createdAt.
        - Purchase Price Tracking: Could be a subcollection under each product ('purchaseHistory') or under each seller ('productsSupplied'), storing items like productId, productName, purchasePrice, date, quantity.
        - Adding a seller creates a new document. Editing updates it. Deleting removes it.
      */}
    </>
  );
}
