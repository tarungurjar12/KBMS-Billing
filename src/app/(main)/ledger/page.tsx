
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
import { useForm, useFieldArray } from 'react-hook-form'; // Removed Controller as it's not used directly now
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BookOpen, PlusCircle, Trash2, Search, Users, Truck, DollarSign, XCircle } from 'lucide-react'; // Removed Edit, not used in this page directly for ledger entries, price edit is conditional
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, where, doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
// Removed User as FirebaseUser type as it's not directly used here; auth.currentUser is used.
import type { Customer } from './../customers/page';
import type { Seller } from './../sellers/page';
import type { Product } from './../products/page';
import { format, parseISO } from 'date-fns';

/**
 * @fileOverview Daily Ledger page for recording sales and purchases.
 * Allows selection of existing customers/sellers or adding new ones on the fly.
 * Supports "Unknown Customer" for cash sales.
 * Integrates with product stock, updating Firestore.
 * Price editing for ledger items is admin-only.
 * Data is fetched from and saved to Firebase Firestore.
 */

// Interfaces
/**
 * Interface for individual items within a ledger entry.
 */
interface LedgerItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number; // Price per unit for this specific transaction
  totalPrice: number; // Calculated: quantity * unitPrice
  unitOfMeasure: string;
}

/**
 * Interface representing a Ledger Entry document in Firestore.
 */
export interface LedgerEntry {
  id?: string; // Firestore document ID, generated automatically
  date: string; // Date of transaction, stored as ISOString YYYY-MM-DD
  type: 'sale' | 'purchase'; // Type of transaction
  entityType: 'customer' | 'seller' | 'unknown_customer'; // Type of entity involved
  entityId?: string; // Firestore ID of Customer or Seller (if not 'unknown_customer')
  entityName: string; // Name of Customer/Seller, or "Unknown Customer"
  items: LedgerItem[]; // Array of products involved in the transaction
  subTotal: number; // Sum of totalPrice for all items
  taxAmount: number; // Calculated tax amount (e.g., GST)
  grandTotal: number; // subTotal + taxAmount
  paymentMethod?: string; // e.g., "Cash", "UPI", "Card"
  paymentStatus?: 'paid' | 'pending' | 'partial'; // Status of payment
  notes?: string; // Optional notes for the transaction
  createdBy: string; // UID of the Firebase user who created the entry
  createdAt: Timestamp; // Firestore Timestamp when the entry was created
}

// Zod Schemas for form validation
const ledgerItemSchema = z.object({
  productId: z.string().min(1, "Product selection is required."),
  productName: z.string(), 
  quantity: z.number().min(0.01, "Quantity must be greater than 0."), 
  unitPrice: z.number().min(0, "Unit price cannot be negative."),
  totalPrice: z.number(), 
  unitOfMeasure: z.string(), 
});

const ledgerEntrySchema = z.object({
  date: z.string().refine(val => !isNaN(parseISO(val).valueOf()), { message: "A valid date is required." }),
  type: z.enum(['sale', 'purchase'], { required_error: "Transaction type is required." }),
  entityType: z.enum(['customer', 'seller', 'unknown_customer'], { required_error: "Entity type is required." }),
  entityId: z.string().optional(),
  entityName: z.string().min(1, "Entity name is required (select Customer/Seller or use 'Unknown Customer')."),
  items: z.array(ledgerItemSchema).min(1, "At least one item must be added to the ledger."),
  paymentMethod: z.string().optional(),
  paymentStatus: z.enum(['paid', 'pending', 'partial']).optional(),
  notes: z.string().optional(),
});
type LedgerFormValues = z.infer<typeof ledgerEntrySchema>;

const newCustomerSchema = z.object({ name: z.string().min(2, "Name requires at least 2 chars."), phone: z.string().min(10, "Phone requires at least 10 digits.") });
type NewCustomerFormValues = z.infer<typeof newCustomerSchema>;
const newSellerSchema = z.object({ name: z.string().min(2, "Name requires at least 2 chars."), phone: z.string().min(10, "Phone requires at least 10 digits.") });
type NewSellerFormValues = z.infer<typeof newSellerSchema>;

// Constants
const GST_RATE = 0.18; 

const getCookie = (name: string): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

/**
 * DailyLedgerPage component.
 * Handles recording of daily sales and purchases, updating stock, and interacting with Firestore.
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
  
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'store_manager' | undefined>();

  useEffect(() => {
    const role = getCookie('userRole');
    if (role === 'admin' || role === 'store_manager') {
      setCurrentUserRole(role);
    }
  }, []);

  const form = useForm<LedgerFormValues>({
    resolver: zodResolver(ledgerEntrySchema),
    defaultValues: {
      date: selectedDate,
      type: 'sale',
      entityType: 'customer',
      entityName: '',
      items: [],
      paymentStatus: 'paid', 
      paymentMethod: 'cash', 
    },
  });
  const { fields, append, remove, update } = useFieldArray({ control: form.control, name: "items" });

  const newCustomerForm = useForm<NewCustomerFormValues>({ resolver: zodResolver(newCustomerSchema), defaultValues: {name: "", phone: ""} });
  const newSellerForm = useForm<NewSellerFormValues>({ resolver: zodResolver(newSellerSchema), defaultValues: {name: "", phone: ""} });
  
  const formatCurrency = useCallback((num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, []);

  const fetchData = useCallback(async (date: string) => {
    setIsLoading(true);
    try {
      const [custSnap, sellSnap, prodSnap, entrySnap] = await Promise.all([
        getDocs(query(collection(db, "customers"), orderBy("name"))),
        getDocs(query(collection(db, "sellers"), orderBy("name"))),
        getDocs(query(collection(db, "products"), orderBy("name"))),
        // Firestore Index Required: 'ledgerEntries' collection, index on 'date' (ASC) and 'createdAt' (DESC).
        getDocs(query(collection(db, "ledgerEntries"), where("date", "==", date), orderBy("createdAt", "desc")))
      ]);
      
      setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
      setSellers(sellSnap.docs.map(d => ({ id: d.id, ...d.data() } as Seller)));
      setProducts(prodSnap.docs.map(d => {
        const data = d.data();
        return { 
            id: d.id, 
            ...data, 
            displayPrice: formatCurrency(data.numericPrice || 0) 
        } as Product;
      }));
      setLedgerEntries(entrySnap.docs.map(d => {
        const data = d.data();
        return { 
            id: d.id, 
            ...data, 
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date() 
        } as unknown as LedgerEntry; 
      }));

    } catch (error: any) {
      console.error("Error fetching data for ledger:", error);
      if (error.code === 'failed-precondition') {
        toast({
            title: "Database Index Required",
            description: `A query for ledger data failed. Please create the required Firestore index for 'ledgerEntries' (date ASC, createdAt DESC). Check the console for a link from Firebase or create manually. Go to: https://console.firebase.google.com/project/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/firestore/indexes`,
            variant: "destructive",
            duration: 15000,
        });
      } else {
        toast({ title: "Data Load Error", description: "Could not load required data for the ledger. Please try again.", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast, formatCurrency]);

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate, fetchData]);

  const transactionTypeWatcher = form.watch("type");
  useEffect(() => {
    form.setValue("entityType", transactionTypeWatcher === 'sale' ? 'customer' : 'seller');
    form.setValue("entityId", undefined);
    form.setValue("entityName", "");
    if (transactionTypeWatcher === 'sale') {
      form.setValue("paymentStatus", "paid"); 
    } else {
      form.setValue("paymentStatus", "pending"); 
    }
  }, [transactionTypeWatcher, form]);

  const entityTypeWatcher = form.watch("entityType");
  useEffect(() => {
    if (entityTypeWatcher === "unknown_customer") {
      form.setValue("entityId", undefined); 
      form.setValue("entityName", "Unknown Customer"); 
      form.setValue("paymentStatus", "paid"); 
    } else if (form.getValues("entityName") === "Unknown Customer" && entityTypeWatcher !== "unknown_customer") {
         form.setValue("entityName", ""); 
    }
  }, [entityTypeWatcher, form]);

  const handleAddProductToLedger = (product: Product) => {
    const existingItemIndex = fields.findIndex(item => item.productId === product.id);
    if (existingItemIndex > -1) { 
        const currentItem = fields[existingItemIndex];
        if (form.getValues("type") === 'sale' && currentItem.quantity + 1 > product.stock) {
            toast({ title: "Stock Alert", description: `Cannot add more ${product.name}. Max available: ${product.stock}`, variant: "destructive"});
            return;
        }
        update(existingItemIndex, {
            ...currentItem,
            quantity: currentItem.quantity + 1,
            totalPrice: (currentItem.quantity + 1) * currentItem.unitPrice,
        });
    } else { 
        if (form.getValues("type") === 'sale' && 1 > product.stock) {
             toast({ title: "Out of Stock", description: `${product.name} is out of stock.`, variant: "destructive"});
            return;
        }
        append({
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unitPrice: product.numericPrice, 
            totalPrice: product.numericPrice,
            unitOfMeasure: product.unitOfMeasure,
        });
    }
    setProductSearchTerm(''); 
  };

  const handleItemQuantityChange = (index: number, quantityStr: string) => { // quantityStr is string from input
    const quantity = parseFloat(quantityStr);
    const item = fields[index];
    const productDetails = products.find(p => p.id === item.productId);

    if (isNaN(quantity) || quantity <= 0) { 
        remove(index);
        return;
    }
    
    let newQuantity = quantity;
    if (form.getValues("type") === 'sale' && productDetails && newQuantity > productDetails.stock) {
        toast({ title: "Stock Alert", description: `Quantity for ${item.productName} exceeds stock (${productDetails.stock}). Setting to max.`, variant: "destructive"});
        newQuantity = productDetails.stock;
        // Update the input field visually if controlled, or form value if using RHF Controller
        form.setValue(`items.${index}.quantity`, newQuantity); 
    }
    update(index, { ...item, quantity: newQuantity, totalPrice: newQuantity * item.unitPrice });
  };
  
  const handleItemPriceChange = (index: number, unitPriceStr: string) => { // unitPriceStr is string from input
    if (currentUserRole !== 'admin') { 
        toast({ title: "Permission Denied", description: "Only Admins can change item prices directly in the ledger.", variant: "destructive" });
        // Revert the value in the form to prevent visual change if not using Controller
        const item = fields[index];
        form.setValue(`items.${index}.unitPrice`, item.unitPrice); // Revert to original price
        return;
    }
    let unitPrice = parseFloat(unitPriceStr);
    if (isNaN(unitPrice) || unitPrice < 0) unitPrice = 0; 
    const item = fields[index];
    update(index, { ...item, unitPrice, totalPrice: item.quantity * unitPrice });
  };

  const onLedgerSubmit = async (data: LedgerFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({ title: "Authentication Error", description: "You must be logged in to save a ledger entry.", variant: "destructive" });
      return;
    }

    const subTotal = data.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = (data.type === 'sale' && data.entityType !== 'unknown_customer') ? subTotal * GST_RATE : 0; 
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
        const newLedgerRef = doc(collection(db, "ledgerEntries"));
        transaction.set(newLedgerRef, ledgerEntryData);

        for (const item of data.items) {
          const productRef = doc(db, "products", item.productId);
          const productSnap = await transaction.get(productRef);
          if (!productSnap.exists()) throw new Error(`Product ${item.productName} (ID: ${item.productId}) not found.`);
          
          const currentStock = productSnap.data().stock as number;
          let newStock = data.type === 'sale' 
            ? currentStock - item.quantity  
            : currentStock + item.quantity; 
          
          if (data.type === 'sale' && newStock < 0) {
            throw new Error(`Insufficient stock for ${item.productName}. Available: ${currentStock}, Requested: ${item.quantity}.`);
          }
          // Ensure stock doesn't go below zero due to float precision issues if quantity wasn't perfectly int
          if (newStock < 0) newStock = 0;
          transaction.update(productRef, { stock: newStock, updatedAt: serverTimestamp() });
        }
      });
      toast({ title: "Ledger Entry Saved", description: "The transaction has been recorded and stock levels updated." });
      form.reset({ date: selectedDate, type: 'sale', entityType: 'customer', entityName: '', items: [], paymentStatus: 'paid', paymentMethod: 'cash' }); 
      fetchData(selectedDate); 
      setProductSearchTerm(''); 
    } catch (error: any) {
      console.error("Error saving ledger entry:", error);
      toast({ title: "Save Error", description: error.message || "Failed to save ledger entry. Please check details and try again.", variant: "destructive" });
    }
  };

  const onNewCustomerSubmit = async (data: NewCustomerFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({ title: "Auth Error", description: "Please log in.", variant: "destructive" });
      return;
    }
    try {
      const docRef = await addDoc(collection(db, "customers"), { 
          ...data, 
          createdAt: serverTimestamp(), 
          totalSpent: "₹0.00", // Initial value
          email: "", // Default empty email
          createdBy: currentUser.uid // Track who created customer
      });
      toast({ title: "Customer Added", description: `${data.name} has been added successfully.` });
      setIsNewCustomerDialogOpen(false);
      newCustomerForm.reset();
      // Re-fetch customers to update the dropdown list and auto-select
      const custSnap = await getDocs(query(collection(db, "customers"), orderBy("name")));
      setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
      
      form.setValue("entityId", docRef.id); 
      form.setValue("entityName", data.name);
    } catch (error: any) {
      toast({ title: "Error Adding Customer", description: error.message || "Failed to add new customer.", variant: "destructive" });
    }
  };

  const onNewSellerSubmit = async (data: NewSellerFormValues) => {
     try {
      const docRef = await addDoc(collection(db, "sellers"), { ...data, createdAt: serverTimestamp(), email:"" }); 
      toast({ title: "Seller Added", description: `${data.name} has been added successfully.` });
      setIsNewSellerDialogOpen(false);
      newSellerForm.reset();
      // Re-fetch sellers to update the dropdown list and auto-select
      const sellSnap = await getDocs(query(collection(db, "sellers"), orderBy("name")));
      setSellers(sellSnap.docs.map(d => ({ id: d.id, ...d.data() } as Seller)));

      form.setValue("entityId", docRef.id); 
      form.setValue("entityName", data.name);
    } catch (error: any) {
      toast({ title: "Error Adding Seller", description: error.message || "Failed to add new seller.", variant: "destructive" });
    }
  };

  const filteredProducts = productSearchTerm
    ? products.filter(p => 
        p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || 
        (p.sku && p.sku.toLowerCase().includes(productSearchTerm.toLowerCase()))
      )
    : [];

  const currentItems = form.watch("items");
  const currentSubtotal = currentItems.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
  const currentTax = (form.watch("type") === 'sale' && form.watch("entityType") !== 'unknown_customer') ? currentSubtotal * GST_RATE : 0;
  const currentGrandTotal = currentSubtotal + currentTax;

  if (isLoading && !customers.length && !products.length && !sellers.length) { 
    return <PageHeader title="Daily Ledger" description="Loading essential data from database..." icon={BookOpen} />;
  }

  return (
    <>
      <PageHeader title="Daily Ledger" description="Record daily sales, purchases, and manage stock movements." icon={BookOpen} />
      
      <Card className="mb-6 shadow-lg rounded-xl">
        <CardHeader><CardTitle className="font-headline text-foreground">New Ledger Entry</CardTitle></CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onLedgerSubmit)}>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>Date of Transaction</FormLabel><FormControl><Input type="date" {...field} onChange={e => { field.onChange(e); setSelectedDate(e.target.value); }} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem><FormLabel>Transaction Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                            <Select 
                                onValueChange={(value) => { 
                                    field.onChange(value); 
                                    const selectedEntity = (form.getValues("type") === 'sale' ? customers : sellers).find(e => e.id === value); 
                                    form.setValue("entityName", selectedEntity?.name || ""); 
                                }} 
                                value={field.value || ""}
                            >
                                <FormControl><SelectTrigger><SelectValue placeholder={`Select existing ${form.getValues("type") === 'sale' ? 'customer' : 'seller'}`} /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {(form.getValues("type") === 'sale' ? customers : sellers).map(e => <SelectItem key={e.id} value={e.id}>{e.name} {e.phone ? `(${e.phone})` : ''}</SelectItem>)}
                                </SelectContent>
                            </Select><FormMessage />
                        </FormItem>)} />
                     <Button type="button" variant="outline" onClick={() => form.getValues("type") === 'sale' ? setIsNewCustomerDialogOpen(true) : setIsNewSellerDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New {form.getValues("type") === 'sale' ? 'Customer' : 'Seller'}
                    </Button>
                </div>
              )}
               <FormField control={form.control} name="entityName" render={({ field }) => (<FormItem className={form.getValues("entityType") === "unknown_customer" ? "" : "hidden"}><FormLabel>Entity Name</FormLabel><FormControl><Input {...field} readOnly /></FormControl><FormMessage /></FormItem>)} />

              <div className="space-y-4 pt-4 border-t">
                <Label className="text-lg font-medium">Items for this Transaction</Label>
                 <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search products by name or SKU to add..." className="pl-8" value={productSearchTerm} onChange={e => setProductSearchTerm(e.target.value)} />
                    {productSearchTerm && (
                        <Button variant="ghost" size="icon" className="absolute right-1 top-0.5 h-8 w-8" onClick={() => setProductSearchTerm("")} title="Clear search">
                            <XCircle className="h-4 w-4" />
                        </Button>
                    )}
                 </div>
                 {productSearchTerm && filteredProducts.length > 0 && (
                  <div className="mt-1 border rounded-md max-h-48 overflow-y-auto bg-background shadow-sm z-10">
                    {filteredProducts.map(p => (
                      <div key={p.id} className="p-2 hover:bg-accent/80 dark:hover:bg-accent/20 cursor-pointer flex justify-between items-center" onClick={() => handleAddProductToLedger(p)}>
                        <div>
                            <p>{p.name} <span className="text-xs text-muted-foreground">({p.sku})</span></p>
                            <p className="text-xs text-muted-foreground">Price: {p.displayPrice} - Stock: {p.stock} {p.unitOfMeasure}</p>
                        </div>
                        <Button variant="ghost" size="sm" disabled={p.stock <= 0 && form.getValues("type") === 'sale'}>
                            {p.stock > 0 || form.getValues("type") === 'purchase' ? "Add" : "Out of stock"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                 {productSearchTerm && filteredProducts.length === 0 && (
                    <p className="mt-2 text-sm text-center text-muted-foreground">No products found matching "{productSearchTerm}".</p>
                 )}

                {fields.map((item, index) => (
                  <Card key={item.id} className="p-3 space-y-2 bg-muted/20 dark:bg-muted/10">
                    <div className="flex justify-between items-center">
                        <p className="font-medium">{item.productName} <span className="text-xs text-muted-foreground">({products.find(p=>p.id === item.productId)?.sku}) - Unit: {item.unitOfMeasure}</span></p>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} title="Remove item"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <FormField
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => ( // field already includes onChange, value, etc.
                                <FormItem><FormLabel className="text-xs">Quantity</FormLabel>
                                  <FormControl><Input type="number" {...field} onChange={e => { field.onChange(parseFloat(e.target.value) || 0); handleItemQuantityChange(index, e.target.value); }} placeholder="Qty" aria-label="Quantity"/></FormControl>
                                <FormMessage/></FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`items.${index}.unitPrice`}
                            render={({ field }) => (
                                <FormItem><FormLabel className="text-xs">Unit Price (₹)</FormLabel>
                                  <FormControl><Input type="number" {...field} onChange={e => { field.onChange(parseFloat(e.target.value) || 0); handleItemPriceChange(index, e.target.value); }} placeholder="Price/Unit" aria-label="Unit Price" disabled={currentUserRole !== 'admin'}/></FormControl>
                                <FormMessage/></FormItem>
                            )}
                        />
                        <FormItem><FormLabel className="text-xs">Total (₹)</FormLabel><Input value={formatCurrency(item.totalPrice)} readOnly placeholder="Total" aria-label="Total Price"/></FormItem>
                    </div>
                     {currentUserRole !== 'admin' && form.getValues(`items.${index}.unitPrice`) !== products.find(p => p.id === item.productId)?.numericPrice && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">Price is based on product database. Only Admins can override price here.</p>
                    )}
                  </Card>
                ))}
                {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No items added to this transaction yet.</p>}
              </div>
              
              <div className="pt-4 border-t space-y-3">
                 <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium">{formatCurrency(currentSubtotal)}</span></div>
                 {(form.watch("type") === 'sale' && form.watch("entityType") !== 'unknown_customer') && <div className="flex justify-between"><span className="text-muted-foreground">Tax (GST {GST_RATE*100}%):</span><span className="font-medium">{formatCurrency(currentTax)}</span></div>}
                 <div className="flex justify-between text-lg font-bold"><span >Grand Total:</span><span>{formatCurrency(currentGrandTotal)}</span></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem><FormLabel>Payment Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "cash"}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem>
                                <SelectItem value="card">Card</SelectItem><SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="credit">Credit (Pay Later)</SelectItem><SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                        </Select><FormMessage />
                    </FormItem>)} />
                <FormField control={form.control} name="paymentStatus" render={({ field }) => (
                    <FormItem><FormLabel>Payment Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "paid"}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="paid">Paid</SelectItem><SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="partial">Partial</SelectItem>
                            </SelectContent>
                        </Select><FormMessage />
                    </FormItem>)} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Input placeholder="Any specific notes for this transaction..." {...field} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoading || fields.length === 0 || form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : "Save Ledger Entry"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      <Card className="mt-8 shadow-lg rounded-xl">
        <CardHeader><CardTitle className="font-headline text-foreground">Entries for {format(parseISO(selectedDate), "MMMM dd, yyyy")}</CardTitle></CardHeader>
        <CardContent>
          {isLoading && ledgerEntries.length === 0 ? <p className="text-center text-muted-foreground py-4">Loading entries...</p> : ledgerEntries.length === 0 ? <p  className="text-center text-muted-foreground py-4">No ledger entries found for this date.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Entity</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Total (₹)</TableHead><TableHead>Payment</TableHead></TableRow></TableHeader>
              <TableBody>
                {ledgerEntries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="capitalize">{entry.type}</TableCell>
                    <TableCell>{entry.entityName}</TableCell>
                    <TableCell>{entry.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entry.grandTotal)}</TableCell>
                    <TableCell className="capitalize">{entry.paymentStatus} {entry.paymentMethod ? `(${entry.paymentMethod})` : ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isNewCustomerDialogOpen} onOpenChange={setIsNewCustomerDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>Add New Customer</DialogTitle><DialogDescription>Quickly add a new customer to the database.</DialogDescription></DialogHeader>
          <Form {...newCustomerForm}><form onSubmit={newCustomerForm.handleSubmit(onNewCustomerSubmit)} className="space-y-4">
            <FormField control={newCustomerForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Customer full name" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={newCustomerForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="Customer phone number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={newCustomerForm.formState.isSubmitting}>{newCustomerForm.formState.isSubmitting ? "Adding..." : "Add Customer"}</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>
      <Dialog open={isNewSellerDialogOpen} onOpenChange={setIsNewSellerDialogOpen}>
         <DialogContent><DialogHeader><DialogTitle>Add New Seller</DialogTitle><DialogDescription>Quickly add a new seller to the database.</DialogDescription></DialogHeader>
          <Form {...newSellerForm}><form onSubmit={newSellerForm.handleSubmit(onNewSellerSubmit)} className="space-y-4">
            <FormField control={newSellerForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="Seller company name" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={newSellerForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="Seller contact number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={newSellerForm.formState.isSubmitting}>{newSellerForm.formState.isSubmitting ? "Adding..." : "Add Seller"}</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

