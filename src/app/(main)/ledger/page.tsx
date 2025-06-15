
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { BookOpen, PlusCircle, Trash2, Search, Users, Truck, DollarSign, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, where, doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
import type { Customer } from './../customers/page';
import type { Seller } from './../sellers/page';
import type { Product } from './../products/page';
import { format, parseISO } from 'date-fns';

/**
 * @fileOverview Daily Ledger page for recording sales and purchases.
 * Allows selection of existing customers/sellers or adding new ones.
 * Integrates with product stock and saves entries to Firestore.
 * Price editing is admin-only.
 */

// Interfaces
interface LedgerItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number; // Price per unit
  totalPrice: number; // quantity * unitPrice
  unitOfMeasure: string;
}

export interface LedgerEntry {
  id?: string; // Firestore document ID
  date: string; // ISOString YYYY-MM-DD
  type: 'sale' | 'purchase' | 'stock_adjustment'; // Extended for future
  entityType: 'customer' | 'seller' | 'internal';
  entityId?: string; // Customer or Seller ID
  entityName: string; // Customer/Seller Name, or "Unknown Customer", or "Stock Adjustment"
  items: LedgerItem[];
  subTotal: number;
  taxAmount: number; // Combined GST or other taxes
  grandTotal: number;
  paymentMethod?: string;
  paymentStatus?: 'paid' | 'pending' | 'partial';
  notes?: string;
  createdBy: string; // UID of user who created entry
  createdAt: Timestamp;
}

// Zod Schemas
const ledgerItemSchema = z.object({
  productId: z.string().min(1, "Product is required."),
  productName: z.string(), // For display, not directly submitted but part of the item object
  quantity: z.number().min(1, "Quantity must be at least 1."),
  unitPrice: z.number().min(0, "Price cannot be negative."),
  totalPrice: z.number(), // Calculated
  unitOfMeasure: z.string(),
});

const ledgerEntrySchema = z.object({
  date: z.string().refine(val => !isNaN(parseISO(val).valueOf()), { message: "Invalid date" }),
  type: z.enum(['sale', 'purchase']),
  entityType: z.enum(['customer', 'seller', 'unknown_customer']),
  entityId: z.string().optional(),
  entityName: z.string().min(1, "Entity name is required (or select Unknown)."),
  items: z.array(ledgerItemSchema).min(1, "At least one item is required."),
  paymentMethod: z.string().optional(),
  paymentStatus: z.enum(['paid', 'pending', 'partial']).optional(),
  notes: z.string().optional(),
});
type LedgerFormValues = z.infer<typeof ledgerEntrySchema>;

const newCustomerSchema = z.object({ name: z.string().min(2), phone: z.string().min(10) });
type NewCustomerFormValues = z.infer<typeof newCustomerSchema>;
const newSellerSchema = z.object({ name: z.string().min(2), phone: z.string().min(10) });
type NewSellerFormValues = z.infer<typeof newSellerSchema>;


const LOW_STOCK_THRESHOLD = 10; // Example
const BUSINESS_STATE_CODE = "29"; // Example: Karnataka
const GST_RATE = 0.18; // Example


/**
 * DailyLedgerPage component.
 * @returns {JSX.Element} The rendered ledger page.
 */
export default function DailyLedgerPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  const [isNewSellerDialogOpen, setIsNewSellerDialogOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  
  const currentUserRole = typeof window !== 'undefined' ? window.document.cookie.includes('userRole=admin') ? 'admin' : 'store_manager' : 'store_manager';

  const form = useForm<LedgerFormValues>({
    resolver: zodResolver(ledgerEntrySchema),
    defaultValues: {
      date: selectedDate,
      type: 'sale',
      entityType: 'customer',
      items: [],
      paymentStatus: 'paid',
    },
  });
  const { fields, append, remove, update } = useFieldArray({ control: form.control, name: "items" });

  const newCustomerForm = useForm<NewCustomerFormValues>({ resolver: zodResolver(newCustomerSchema) });
  const newSellerForm = useForm<NewSellerFormValues>({ resolver: zodResolver(newSellerSchema) });
  
  const formatCurrency = useCallback((num: number) => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, []);

  // Fetch initial data (customers, sellers, products, ledger entries for selectedDate)
  const fetchData = useCallback(async (date: string) => {
    setIsLoading(true);
    try {
      const [custSnap, sellSnap, prodSnap, entrySnap] = await Promise.all([
        getDocs(query(collection(db, "customers"), orderBy("name"))),
        getDocs(query(collection(db, "sellers"), orderBy("name"))),
        getDocs(query(collection(db, "products"), orderBy("name"))),
        getDocs(query(collection(db, "ledgerEntries"), where("date", "==", date), orderBy("createdAt", "desc")))
      ]);
      setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
      setSellers(sellSnap.docs.map(d => ({ id: d.id, ...d.data() } as Seller)));
      setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data(), price: formatCurrency(d.data().numericPrice), displayPrice: formatCurrency(d.data().numericPrice) } as Product))); // Add displayPrice
      setLedgerEntries(entrySnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt.toDate() } as unknown as LedgerEntry)));
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error", description: "Could not load data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, formatCurrency]);

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate, fetchData]);

  // Watch for entityType changes to clear entityId/Name if switching to "Unknown Customer"
  const entityTypeWatcher = form.watch("entityType");
  useEffect(() => {
    if (entityTypeWatcher === "unknown_customer") {
      form.setValue("entityId", undefined);
      form.setValue("entityName", "Unknown Customer");
    } else if (form.getValues("entityName") === "Unknown Customer") {
         form.setValue("entityName", ""); // Clear if switching away from unknown
    }
  }, [entityTypeWatcher, form]);

  const handleAddProductToLedger = (product: Product) => {
    const existingItemIndex = fields.findIndex(item => item.productId === product.id);
    if (existingItemIndex > -1) {
        const currentItem = fields[existingItemIndex];
        update(existingItemIndex, {
            ...currentItem,
            quantity: currentItem.quantity + 1,
            totalPrice: (currentItem.quantity + 1) * currentItem.unitPrice,
        });
    } else {
        append({
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unitPrice: product.numericPrice, // Default to product's base price
            totalPrice: product.numericPrice,
            unitOfMeasure: product.unitOfMeasure,
        });
    }
    setProductSearchTerm('');
  };

  const handleItemQuantityChange = (index: number, quantity: number) => {
    const item = fields[index];
    if (quantity < 1) { // Remove item if quantity is less than 1
        remove(index);
        return;
    }
    update(index, { ...item, quantity, totalPrice: quantity * item.unitPrice });
  };
  
  const handleItemPriceChange = (index: number, unitPrice: number) => {
    if (currentUserRole !== 'admin') {
        toast({ title: "Permission Denied", description: "Only Admins can change item prices.", variant: "destructive" });
        return;
    }
    const item = fields[index];
    update(index, { ...item, unitPrice, totalPrice: item.quantity * unitPrice });
  };


  const onLedgerSubmit = async (data: LedgerFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    const subTotal = data.items.reduce((sum, item) => sum + item.totalPrice, 0);
    // Simplified tax calculation
    const taxAmount = (data.type === 'sale') ? subTotal * GST_RATE : 0; // Tax only on sales for now
    const grandTotal = subTotal + taxAmount;

    const ledgerEntryData: Omit<LedgerEntry, 'id' | 'createdAt'> & {createdAt: any} = {
      ...data,
      subTotal,
      taxAmount,
      grandTotal,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
    };

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Add ledger entry
        const newLedgerRef = doc(collection(db, "ledgerEntries"));
        transaction.set(newLedgerRef, ledgerEntryData);

        // 2. Update product stock
        for (const item of data.items) {
          const productRef = doc(db, "products", item.productId);
          const productSnap = await transaction.get(productRef);
          if (!productSnap.exists()) throw new Error(`Product ${item.productName} not found.`);
          
          const currentStock = productSnap.data().stock;
          const newStock = data.type === 'sale' 
            ? currentStock - item.quantity 
            : currentStock + item.quantity;
          
          if (data.type === 'sale' && newStock < 0) {
            throw new Error(`Insufficient stock for ${item.productName}. Available: ${currentStock}`);
          }
          transaction.update(productRef, { stock: newStock });
        }
      });
      toast({ title: "Success", description: "Ledger entry saved and stock updated." });
      form.reset({ date: selectedDate, type: 'sale', entityType: 'customer', items: [], paymentStatus: 'paid' });
      fetchData(selectedDate); // Refresh ledger entries for the current date
      setProductSearchTerm('');
    } catch (error: any) {
      console.error("Error saving ledger entry:", error);
      toast({ title: "Error", description: error.message || "Failed to save ledger entry.", variant: "destructive" });
    }
  };

  // New Customer/Seller Dialog Submit Handlers
  const onNewCustomerSubmit = async (data: NewCustomerFormValues) => {
    try {
      const docRef = await addDoc(collection(db, "customers"), { ...data, createdAt: serverTimestamp(), totalSpent: "₹0.00", email: "" }); // Add other default fields as needed
      toast({ title: "Customer Added", description: `${data.name} added.` });
      setIsNewCustomerDialogOpen(false);
      newCustomerForm.reset();
      fetchData(selectedDate); // Re-fetch all data to update dropdowns
      form.setValue("entityId", docRef.id); // Auto-select new customer
      form.setValue("entityName", data.name);
    } catch (error) {
      toast({ title: "Error", description: "Failed to add customer.", variant: "destructive" });
    }
  };
  const onNewSellerSubmit = async (data: NewSellerFormValues) => {
     try {
      const docRef = await addDoc(collection(db, "sellers"), { ...data, createdAt: serverTimestamp(), email:"" });
      toast({ title: "Seller Added", description: `${data.name} added.` });
      setIsNewSellerDialogOpen(false);
      newSellerForm.reset();
      fetchData(selectedDate); // Re-fetch
      form.setValue("entityId", docRef.id); // Auto-select new seller
      form.setValue("entityName", data.name);
    } catch (error) {
      toast({ title: "Error", description: "Failed to add seller.", variant: "destructive" });
    }
  };

  const filteredProducts = productSearchTerm
    ? products.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || p.sku.toLowerCase().includes(productSearchTerm.toLowerCase()))
    : [];

  const currentSubtotal = fields.reduce((acc, item) => acc + item.totalPrice, 0);
  const currentTax = form.getValues("type") === 'sale' ? currentSubtotal * GST_RATE : 0;
  const currentGrandTotal = currentSubtotal + currentTax;

  if (isLoading && !customers.length && !products.length) { // Initial full load
    return <PageHeader title="Daily Ledger" description="Loading data..." icon={BookOpen} />;
  }

  return (
    <>
      <PageHeader title="Daily Ledger" description="Record daily sales, purchases, and stock movements." icon={BookOpen} />
      
      <Card className="mb-6 shadow-lg rounded-xl">
        <CardHeader><CardTitle>New Ledger Entry</CardTitle></CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onLedgerSubmit)}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} onChange={e => { field.onChange(e); setSelectedDate(e.target.value); }} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem><FormLabel>Transaction Type</FormLabel>
                        <Select onValueChange={(value) => { field.onChange(value); form.setValue("entityType", value === 'sale' ? 'customer' : 'seller'); form.setValue("entityId", undefined); form.setValue("entityName", "");}} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="sale">Sale / Stock Out</SelectItem><SelectItem value="purchase">Purchase / Stock In</SelectItem></SelectContent>
                        </Select><FormMessage />
                    </FormItem>)} />
                <FormField control={form.control} name="entityType" render={({ field }) => (
                    <FormItem><FormLabel>{form.getValues("type") === 'sale' ? 'Customer Type' : 'Seller Type'}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value={form.getValues("type") === 'sale' ? "customer" : "seller"}>Existing {form.getValues("type") === 'sale' ? 'Customer' : 'Seller'}</SelectItem>
                                {form.getValues("type") === 'sale' && <SelectItem value="unknown_customer">Unknown Customer (Cash Sale)</SelectItem>}
                            </SelectContent>
                        </Select><FormMessage />
                    </FormItem>)} />
              </div>

              {form.getValues("entityType") !== "unknown_customer" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <FormField control={form.control} name="entityId" render={({ field }) => (
                        <FormItem><FormLabel>{form.getValues("type") === 'sale' ? 'Select Customer' : 'Select Seller'}</FormLabel>
                            <Select onValueChange={(value) => { field.onChange(value); const selected = (form.getValues("type") === 'sale' ? customers : sellers).find(e => e.id === value); form.setValue("entityName", selected?.name || ""); }} value={field.value || ""}>
                                <FormControl><SelectTrigger><SelectValue placeholder={`Select existing ${form.getValues("type") === 'sale' ? 'customer' : 'seller'}`} /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {(form.getValues("type") === 'sale' ? customers : sellers).map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.phone})</SelectItem>)}
                                </SelectContent>
                            </Select><FormMessage />
                        </FormItem>)} />
                     <Button type="button" variant="outline" onClick={() => form.getValues("type") === 'sale' ? setIsNewCustomerDialogOpen(true) : setIsNewSellerDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New {form.getValues("type") === 'sale' ? 'Customer' : 'Seller'}
                    </Button>
                </div>
              )}
               <FormField control={form.control} name="entityName" render={({ field }) => (<FormItem className={form.getValues("entityType") === "unknown_customer" ? "" : "hidden"}><FormLabel>Entity Name (Readonly)</FormLabel><FormControl><Input {...field} readOnly /></FormControl><FormMessage /></FormItem>)} />


              {/* Items Array */}
              <div className="space-y-4 pt-4 border-t">
                <Label className="text-lg font-medium">Items</Label>
                 <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search products to add..." className="pl-8" value={productSearchTerm} onChange={e => setProductSearchTerm(e.target.value)} />
                 </div>
                 {productSearchTerm && filteredProducts.length > 0 && (
                  <div className="mt-1 border rounded-md max-h-48 overflow-y-auto bg-background shadow-sm z-10">
                    {filteredProducts.map(p => (
                      <div key={p.id} className="p-2 hover:bg-accent/80 dark:hover:bg-accent/20 cursor-pointer flex justify-between items-center" onClick={() => handleAddProductToLedger(p)}>
                        <span>{p.name} ({p.sku}) - Stock: {p.stock}</span>
                        <Button variant="ghost" size="sm" disabled={p.stock <= 0 && form.getValues("type") === 'sale'}>
                            {p.stock > 0 || form.getValues("type") === 'purchase' ? "Add" : "Out of stock"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {fields.map((item, index) => (
                  <Card key={item.id} className="p-3 space-y-2 bg-muted/30">
                    <div className="flex justify-between items-center">
                        <p className="font-medium">{item.productName} <span className="text-xs text-muted-foreground">({products.find(p=>p.id === item.productId)?.sku})</span></p>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <Input type="number" value={item.quantity} onChange={e => handleItemQuantityChange(index, parseInt(e.target.value))} placeholder="Qty" aria-label="Quantity"/>
                        <Input type="number" value={item.unitPrice} onChange={e => handleItemPriceChange(index, parseFloat(e.target.value))} placeholder="Price/Unit" aria-label="Unit Price" disabled={currentUserRole !== 'admin'}/>
                        <Input value={formatCurrency(item.totalPrice)} readOnly placeholder="Total" aria-label="Total Price"/>
                    </div>
                     {currentUserRole !== 'admin' && form.getValues("items")[index].unitPrice !== products.find(p => p.id === item.productId)?.numericPrice && (
                        <p className="text-xs text-amber-600">Price determined by rules. Admin can override.</p>
                    )}
                  </Card>
                ))}
                {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No items added yet.</p>}
              </div>
              
              {/* Summary & Payment */}
              <div className="pt-4 border-t space-y-3">
                 <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium">{formatCurrency(currentSubtotal)}</span></div>
                 {form.getValues("type") === 'sale' && <div className="flex justify-between"><span className="text-muted-foreground">Tax (GST {GST_RATE*100}%):</span><span className="font-medium">{formatCurrency(currentTax)}</span></div>}
                 <div className="flex justify-between text-lg font-bold"><span >Grand Total:</span><span>{formatCurrency(currentGrandTotal)}</span></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem><FormLabel>Payment Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem>
                                <SelectItem value="card">Card</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="credit">Credit (Pay Later)</SelectItem>
                            </SelectContent>
                        </Select><FormMessage />
                    </FormItem>)} />
                <FormField control={form.control} name="paymentStatus" render={({ field }) => (
                    <FormItem><FormLabel>Payment Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="paid">Paid</SelectItem><SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="partial">Partial</SelectItem>
                            </SelectContent>
                        </Select><FormMessage />
                    </FormItem>)} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Input placeholder="Any notes for this transaction..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading || fields.length === 0}>Save Ledger Entry</Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {/* Display Ledger Entries for selectedDate */}
      <Card className="mt-8 shadow-lg rounded-xl">
        <CardHeader><CardTitle>Entries for {format(parseISO(selectedDate), "MMMM dd, yyyy")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading && ledgerEntries.length === 0 ? <p>Loading entries...</p> : ledgerEntries.length === 0 ? <p>No entries for this date.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Entity</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Payment</TableHead></TableRow></TableHeader>
              <TableBody>
                {ledgerEntries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="capitalize">{entry.type}</TableCell>
                    <TableCell>{entry.entityName}</TableCell>
                    <TableCell>{entry.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entry.grandTotal)}</TableCell>
                    <TableCell className="capitalize">{entry.paymentStatus} ({entry.paymentMethod})</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Customer Dialog */}
      <Dialog open={isNewCustomerDialogOpen} onOpenChange={setIsNewCustomerDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add New Customer</DialogTitle><DialogDescription>Quickly add a new customer.</DialogDescription></DialogHeader>
          <Form {...newCustomerForm}><form onSubmit={newCustomerForm.handleSubmit(onNewCustomerSubmit)} className="space-y-4">
            <FormField control={newCustomerForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={newCustomerForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit">Add Customer</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>
      {/* New Seller Dialog */}
      <Dialog open={isNewSellerDialogOpen} onOpenChange={setIsNewSellerDialogOpen}>
         <DialogContent><DialogHeader><DialogTitle>Add New Seller</DialogTitle><DialogDescription>Quickly add a new seller.</DialogDescription></DialogHeader>
          <Form {...newSellerForm}><form onSubmit={newSellerForm.handleSubmit(onNewSellerSubmit)} className="space-y-4">
            <FormField control={newSellerForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={newSellerForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit">Add Seller</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
