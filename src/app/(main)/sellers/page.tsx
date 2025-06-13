
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Truck, PlusCircle, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


interface Seller {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone: string;
  address?: string;
  gstin?: string;
  bankDetails?: string; // Could be an object in a real app
  purchaseTerms?: string;
}

const initialSellers: Seller[] = [
    {id: "SELL001", name: "Acme Building Supplies", contactPerson: "Rohan Patel", email: "rohan@acmebs.com", phone: "9876543210", address: "123 Industrial Area, Mumbai", gstin: "27AXYZS1234B1Z5", bankDetails: "HDFC A/C XXXXXX, IFSC HDFC000123", purchaseTerms: "Net 30"},
    {id: "SELL002", name: "Bharat Hardware Co.", contactPerson: "Priya Singh", email: "priya.singh@bharathardware.com", phone: "8765432109", address: "45 Market Road, Delhi", gstin: "07BCHCS5678A1Z2", bankDetails: "ICICI A/C YYYYYY, IFSC ICIC000456", purchaseTerms: "Payment on Delivery"},
];

const sellerSchema = z.object({
  name: z.string().min(3, { message: "Seller name must be at least 3 characters." }),
  contactPerson: z.string().optional(),
  email: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  phone: z.string().min(10, { message: "Phone number must be at least 10 digits." }),
  address: z.string().optional(),
  gstin: z.string().optional(), // Add more specific GSTIN validation if needed
  bankDetails: z.string().optional(),
  purchaseTerms: z.string().optional(),
});

type SellerFormValues = z.infer<typeof sellerSchema>;


export default function ManageSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>(initialSellers);
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

  // Placeholder for fetching sellers
  // useEffect(() => {
  //   // async function fetchSellers() { /* ... cloud fetch ... */ setSellers(data); }
  //   // fetchSellers();
  // }, []);

  useEffect(() => {
    if (editingSeller && isEditSellerDialogOpen) {
      form.reset(editingSeller);
    } else {
      form.reset({ name: "", contactPerson: "", email: "", phone: "", address: "", gstin: "", bankDetails: "", purchaseTerms: "" });
    }
  }, [editingSeller, isEditSellerDialogOpen, form]);

  const handleAddSubmit = (values: SellerFormValues) => {
    // For future cloud integration:
    // try { /* await api.createSeller(values); */ } catch { /* toast error */ }

    const newSeller: Seller = {
      id: `SELL-${Date.now()}`,
      ...values,
    };
    setSellers((prev) => [newSeller, ...prev]);
    toast({ title: "Seller Added", description: `${values.name} has been added.` });
    form.reset();
    setIsAddSellerDialogOpen(false);
  };

  const handleEditSubmit = (values: SellerFormValues) => {
    if (!editingSeller) return;
    // For future cloud integration:
    // try { /* await api.updateSeller(editingSeller.id, values); */ } catch { /* toast error */ }

    const updatedSeller = { ...editingSeller, ...values };
    setSellers((prev) => prev.map((s) => (s.id === editingSeller.id ? updatedSeller : s)));
    toast({ title: "Seller Updated", description: `${values.name} has been updated.` });
    setEditingSeller(null);
    setIsEditSellerDialogOpen(false);
    form.reset();
  };

  const openEditDialog = (seller: Seller) => {
    setEditingSeller(seller);
    setIsEditSellerDialogOpen(true);
  };

  const openDeleteDialog = (seller: Seller) => {
    setSellerToDelete(seller);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!sellerToDelete) return;
    // For future cloud integration:
    // try { /* await api.deleteSeller(sellerToDelete.id); */ } catch { /* toast error */ }

    setSellers((prev) => prev.filter((s) => s.id !== sellerToDelete.id));
    toast({ title: "Seller Deleted", description: `${sellerToDelete.name} has been deleted.`, variant: "destructive" });
    setSellerToDelete(null);
    setIsDeleteConfirmOpen(false);
  };

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


  return (
    <>
      <PageHeader
        title="Manage Sellers"
        description="Administer seller/supplier accounts and information."
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
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{sellerToDelete?.name}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setSellerToDelete(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete Seller</AlertDialogAction></AlertDialogFooter>
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
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Actions</span></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openEditDialog(seller)}><Edit className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toast({title: "Record Payment (Placeholder)", description: `Functionality to record payment for ${seller.name} to be implemented.`})}>
                                           <Eye className="mr-2 h-4 w-4" /> Record Outgoing Payment
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openDeleteDialog(seller)} className="text-destructive focus:text-destructive-foreground"><Trash2 className="mr-2 h-4 w-4" /> Delete Seller</DropdownMenuItem>
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
      {/* Comment for future data persistence:
          The 'sellers' state is managed locally.
          For cloud integration (e.g., Firebase Firestore):
          - Fetch sellers from Firestore in useEffect.
          - CRUD operations would call API endpoints interacting with Firestore.
          - Sensitive data like bank details should be handled with appropriate security measures (encryption, access controls) on the backend.
          - Example: `await firestore.collection('sellers').add(newSellerData);`
      */}
    </>
  );
}

    