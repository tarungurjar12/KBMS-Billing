
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BookOpen, PlusCircle, Trash2, Search, Users, Truck, DollarSign, XCircle, Filter } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, where, doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
import type { Customer } from './../customers/page';
import type { Seller } from './../sellers/page';
import type { Product } from './../products/page';
import { format, parseISO } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';

/**
 * @fileOverview Daily Ledger page for recording sales and purchases.
 * Allows selection of existing customers/sellers or adding new ones on the fly.
 * Supports "Unknown Customer" for cash sales and "Unknown Seller" for cash purchases.
 * Integrates with product stock, updating Firestore.
 * Price editing for ledger items is admin-only. Optional GST application.
 * Data is fetched from and saved to Firebase Firestore.
 */

// Interfaces
/**
 * Interface for individual items within a ledger entry.
 */
export interface LedgerItem {
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
  id?: string; 
  date: string; 
  type: 'sale' | 'purchase'; 
  entityType: 'customer' | 'seller' | 'unknown_customer' | 'unknown_seller'; 
  entityId: string | null; 
  entityName: string; 
  items: LedgerItem[]; 
  subTotal: number; 
  gstApplied: boolean; 
  taxAmount: number; 
  grandTotal: number; 
  paymentMethod: string | null; 
  paymentStatus: 'paid' | 'pending' | 'partial' | null; 
  notes: string | null; 
  createdBy: string; 
  createdAt: Timestamp; 
}

// Zod Schemas
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
  entityType: z.enum(['customer', 'seller', 'unknown_customer', 'unknown_seller'], { required_error: "Entity type is required." }),
  entityId: z.string().optional(), // Optional because of "unknown" types
  entityName: z.string().min(1, "Entity name is required."),
  items: z.array(ledgerItemSchema).min(1, "At least one item must be added to the ledger."),
  applyGst: z.boolean().default(false),
  paymentMethod: z.string().optional(),
  paymentStatus: z.enum(['paid', 'pending', 'partial']).optional(),
  notes: z.string().optional(),
});
type LedgerFormValues = z.infer<typeof ledgerEntrySchema>;

const newCustomerSellerSchema = z.object({ name: z.string().min(2, "Name requires at least 2 chars."), phone: z.string().min(10, "Phone requires at least 10 digits.") });
type NewCustomerSellerFormValues = z.infer<typeof newCustomerSellerSchema>;

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
 */
export default function DailyLedgerPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [isLedgerFormOpen, setIsLedgerFormOpen] = useState(false);
  const [isNewEntityDialogOpen, setIsNewEntityDialogOpen] = useState(false);
  const [newEntityType, setNewEntityType] = useState<'customer' | 'seller'>('customer');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [activeLedgerTab, setActiveLedgerTab] = useState<'all' | 'sales' | 'purchases'>('all');
  
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
      applyGst: false,
      paymentStatus: 'paid',
      paymentMethod: 'Cash', // Default changed for consistency
    },
  });
  const { fields, append, remove, update } = useFieldArray({ control: form.control, name: "items" });

  const newEntityForm = useForm<NewCustomerSellerFormValues>({ resolver: zodResolver(newCustomerSellerSchema), defaultValues: {name: "", phone: ""} });
  
  const formatCurrency = useCallback((num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, []);

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
      setProducts(prodSnap.docs.map(d => {
        const data = d.data();
        return { 
            id: d.id, 
            ...data, 
            displayPrice: formatCurrency(data.numericPrice || 0) 
        } as Product;
      }));
      setLedgerEntries(entrySnap.docs.map(d => ({ id: d.id, ...d.data() } as LedgerEntry)));

    } catch (error: any) {
      console.error("Error fetching data for ledger:", error);
      if (error.code === 'failed-precondition') {
        toast({
            title: "Database Index Required",
            description: `A query for ledger data failed. Please create the required Firestore index for 'ledgerEntries' (date ASC, createdAt DESC). Check your browser's developer console for a Firebase error message with a link to create it.`,
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
  
  useEffect(() => {
    form.setValue("date", selectedDate); // Keep form date synced with page selected date
  }, [selectedDate, form]);

  const transactionTypeWatcher = form.watch("type");
  useEffect(() => {
    form.setValue("entityType", transactionTypeWatcher === 'sale' ? 'customer' : 'seller');
    form.setValue("entityId", undefined);
    form.setValue("entityName", "");
    form.setValue("paymentStatus", transactionTypeWatcher === 'sale' ? "paid" : "pending");
  }, [transactionTypeWatcher, form]);

  const entityTypeWatcher = form.watch("entityType");
  useEffect(() => {
    if (entityTypeWatcher === "unknown_customer") {
      form.setValue("entityId", undefined); 
      form.setValue("entityName", "Unknown Customer"); 
      form.setValue("paymentStatus", "paid"); 
    } else if (entityTypeWatcher === "unknown_seller") {
      form.setValue("entityId", undefined);
      form.setValue("entityName", "Unknown Seller");
      form.setValue("paymentStatus", "paid");
    } else if ((form.getValues("entityName") === "Unknown Customer" || form.getValues("entityName") === "Unknown Seller") && 
               (entityTypeWatcher === "customer" || entityTypeWatcher === "seller")) {
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

  const handleItemQuantityChange = (index: number, quantityStr: string) => {
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
        form.setValue(`items.${index}.quantity`, newQuantity); 
    }
    update(index, { ...item, quantity: newQuantity, totalPrice: newQuantity * item.unitPrice });
  };
  
  const handleItemPriceChange = (index: number, unitPriceStr: string) => {
    if (currentUserRole !== 'admin') { 
        toast({ title: "Permission Denied", description: "Only Admins can change item prices directly in the ledger.", variant: "destructive" });
        const item = fields[index];
        form.setValue(`items.${index}.unitPrice`, item.unitPrice); 
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
    const taxAmount = data.applyGst ? subTotal * GST_RATE : 0;
    const grandTotal = subTotal + taxAmount;

    const ledgerEntryData: Omit<LedgerEntry, 'id' | 'createdAt'> & {createdAt: any} = {
      date: data.date,
      type: data.type,
      entityType: data.entityType,
      entityId: data.entityId || null,
      entityName: data.entityName,
      items: data.items,
      subTotal,
      gstApplied: data.applyGst,
      taxAmount,
      grandTotal,
      paymentMethod: data.paymentMethod || null,
      paymentStatus: data.paymentStatus || null,
      notes: data.notes || null,
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
          if (newStock < 0) newStock = 0;
          transaction.update(productRef, { stock: newStock, updatedAt: serverTimestamp() });
        }
      });
      toast({ title: "Ledger Entry Saved", description: "The transaction has been recorded and stock levels updated." });
      form.reset({ date: selectedDate, type: 'sale', entityType: 'customer', entityName: '', items: [], applyGst: false, paymentStatus: 'paid', paymentMethod: 'Cash' });
      setIsLedgerFormOpen(false);
      fetchData(selectedDate); 
      setProductSearchTerm(''); 
    } catch (error: any) {
      console.error("Error saving ledger entry:", error);
      toast({ title: "Save Error", description: error.message || "Failed to save ledger entry. Please check details and try again.", variant: "destructive" });
    }
  };

  const onNewEntitySubmit = async (data: NewCustomerSellerFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({ title: "Auth Error", description: "Please log in.", variant: "destructive" });
      return;
    }
    const collectionName = newEntityType === 'customer' ? "customers" : "sellers";
    try {
      const docRef = await addDoc(collection(db, collectionName), { 
          ...data, 
          createdAt: serverTimestamp(), 
          email: "", 
          ...(newEntityType === 'customer' && { totalSpent: "₹0.00", createdBy: currentUser.uid })
      });
      toast({ title: `${newEntityType.charAt(0).toUpperCase() + newEntityType.slice(1)} Added`, description: `${data.name} has been added successfully.` });
      setIsNewEntityDialogOpen(false);
      newEntityForm.reset();
      
      if (newEntityType === 'customer') {
        const custSnap = await getDocs(query(collection(db, "customers"), orderBy("name")));
        setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
      } else {
        const sellSnap = await getDocs(query(collection(db, "sellers"), orderBy("name")));
        setSellers(sellSnap.docs.map(d => ({ id: d.id, ...d.data() } as Seller)));
      }
      
      form.setValue("entityId", docRef.id); 
      form.setValue("entityName", data.name);
    } catch (error: any) {
      toast({ title: `Error Adding ${newEntityType}`, description: error.message || `Failed to add new ${newEntityType}.`, variant: "destructive" });
    }
  };

  const filteredProducts = productSearchTerm
    ? products.filter(p => 
        p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || 
        (p.sku && p.sku.toLowerCase().includes(productSearchTerm.toLowerCase()))
      )
    : [];

  const itemsWatcher = form.watch("items");
  const applyGstWatcher = form.watch("applyGst");
  const currentSubtotal = itemsWatcher.reduce((acc, item) => acc + (item.totalPrice || 0), 0);
  const currentTax = applyGstWatcher ? currentSubtotal * GST_RATE : 0;
  const currentGrandTotal = currentSubtotal + currentTax;

  const displayedLedgerEntries = ledgerEntries
    .filter(entry => {
        if (activeLedgerTab === 'sales') return entry.type === 'sale';
        if (activeLedgerTab === 'purchases') return entry.type === 'purchase';
        return true; // 'all' tab
    })
    .filter(entry => {
        if (!ledgerSearchTerm) return true;
        const searchTermLower = ledgerSearchTerm.toLowerCase();
        const matchesEntity = entry.entityName.toLowerCase().includes(searchTermLower);
        const matchesItems = entry.items.some(item =>
            item.productName.toLowerCase().includes(searchTermLower) ||
            item.quantity.toString().includes(searchTermLower) ||
            item.unitPrice.toString().includes(searchTermLower)
        );
        return matchesEntity || matchesItems;
    });

  if (isLoading && !customers.length && !products.length && !sellers.length) { 
    return <PageHeader title="Daily Ledger" description="Loading essential data..." icon={BookOpen} />;
  }

  return (
    <>
      <PageHeader 
        title="Daily Ledger" 
        description="Record daily sales, purchases, and manage stock movements." 
        icon={BookOpen} 
        actions={
            <Button onClick={() => { 
                form.reset({ date: selectedDate, type: 'sale', entityType: 'customer', entityName: '', items: [], applyGst: false, paymentStatus: 'paid', paymentMethod: 'Cash' });
                setIsLedgerFormOpen(true); 
            }}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Ledger Entry
            </Button>
        }
      />

      <Dialog open={isLedgerFormOpen} onOpenChange={setIsLedgerFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Ledger Entry</DialogTitle>
            <DialogDescription>Fill in the details for the new transaction.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onLedgerSubmit)} className="max-h-[75vh] overflow-y-auto pr-4">
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem><FormLabel>Date of Transaction</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                                  {form.getValues("type") === 'purchase' && <SelectItem value="unknown_seller">Unknown Seller (Cash Purchase)</SelectItem>}
                              </SelectContent>
                          </Select><FormMessage />
                      </FormItem>)} />
                </div>

                {form.getValues("entityType") !== "unknown_customer" && form.getValues("entityType") !== "unknown_seller" && (
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
                       <Button type="button" variant="outline" onClick={() => { setNewEntityType(form.getValues("type") === 'sale' ? 'customer' : 'seller'); setIsNewEntityDialogOpen(true); }}>
                          <PlusCircle className="mr-2 h-4 w-4" /> Add New {form.getValues("type") === 'sale' ? 'Customer' : 'Seller'}
                      </Button>
                  </div>
                )}
                 <FormField control={form.control} name="entityName" render={({ field }) => (<FormItem className={(form.getValues("entityType") === "unknown_customer" || form.getValues("entityType") === "unknown_seller") ? "" : "hidden"}><FormLabel>Entity Name</FormLabel><FormControl><Input {...field} readOnly /></FormControl><FormMessage /></FormItem>)} />

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
                          <FormField control={form.control} name={`items.${index}.quantity`} render={({ field: f }) => (
                                  <FormItem><FormLabel className="text-xs">Quantity</FormLabel>
                                    <FormControl><Input type="number" {...f} onChange={e => { f.onChange(parseFloat(e.target.value) || 0); handleItemQuantityChange(index, e.target.value); }} placeholder="Qty" aria-label="Quantity"/></FormControl>
                                  <FormMessage/></FormItem>)} />
                          <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field: f }) => (
                                  <FormItem><FormLabel className="text-xs">Unit Price (₹)</FormLabel>
                                    <FormControl><Input type="number" {...f} onChange={e => { f.onChange(parseFloat(e.target.value) || 0); handleItemPriceChange(index, e.target.value); }} placeholder="Price/Unit" aria-label="Unit Price" disabled={currentUserRole !== 'admin'}/></FormControl>
                                  <FormMessage/></FormItem>)} />
                          <FormItem><FormLabel className="text-xs">Total (₹)</FormLabel><Input value={formatCurrency(item.totalPrice)} readOnly placeholder="Total" aria-label="Total Price"/></FormItem>
                      </div>
                       {currentUserRole !== 'admin' && form.getValues(`items.${index}.unitPrice`) !== products.find(p => p.id === item.productId)?.numericPrice && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">Price is based on product database. Only Admins can override price here.</p>
                      )}
                    </Card>
                  ))}
                  {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No items added to this transaction yet.</p>}
                </div>
                
                <FormField control={form.control} name="applyGst" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                          <FormLabel>Apply GST (18%)</FormLabel>
                          <FormDescription>Calculate and add GST to this transaction.</FormDescription>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />

                <div className="pt-4 border-t space-y-3">
                   <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium">{formatCurrency(currentSubtotal)}</span></div>
                   {form.watch("applyGst") && <div className="flex justify-between"><span className="text-muted-foreground">Tax (GST {GST_RATE*100}%):</span><span className="font-medium">{formatCurrency(currentTax)}</span></div>}
                   <div className="flex justify-between text-lg font-bold"><span >Grand Total:</span><span>{formatCurrency(currentGrandTotal)}</span></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                      <FormItem><FormLabel>Payment Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ""}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger></FormControl>
                              <SelectContent>
                                  <SelectItem value="Cash">Cash</SelectItem><SelectItem value="UPI">UPI</SelectItem>
                                  <SelectItem value="Card">Card</SelectItem><SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                  <SelectItem value="Credit">Credit (Pay Later)</SelectItem><SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                          </Select><FormMessage />
                      </FormItem>)} />
                  <FormField control={form.control} name="paymentStatus" render={({ field }) => (
                      <FormItem><FormLabel>Payment Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? ""}>
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
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isLoading || fields.length === 0 || form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Saving..." : "Save Ledger Entry"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

       <Dialog open={isNewEntityDialogOpen} onOpenChange={setIsNewEntityDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add New {newEntityType.charAt(0).toUpperCase() + newEntityType.slice(1)}</DialogTitle>
                <DialogDescription>Quickly add a new {newEntityType} to the database.</DialogDescription>
            </DialogHeader>
          <Form {...newEntityForm}><form onSubmit={newEntityForm.handleSubmit(onNewEntitySubmit)} className="space-y-4">
            <FormField control={newEntityForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder={`${newEntityType} full name`} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={newEntityForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder={`${newEntityType} phone number`} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={newEntityForm.formState.isSubmitting}>{newEntityForm.formState.isSubmitting ? "Adding..." : `Add ${newEntityType.charAt(0).toUpperCase() + newEntityType.slice(1)}`}</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>

      <Card className="mt-6 shadow-lg rounded-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="font-headline text-foreground">Ledger Entries for {format(parseISO(selectedDate), "MMMM dd, yyyy")}</CardTitle>
              <CardDescription>Browse recorded transactions for the selected date.</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                 <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full sm:w-auto"/>
                 <div className="relative w-full sm:w-64">
                     <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                     <Input placeholder="Search entries..." className="pl-8" value={ledgerSearchTerm} onChange={e => setLedgerSearchTerm(e.target.value)} />
                 </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeLedgerTab} onValueChange={(value) => setActiveLedgerTab(value as any)} className="w-full mb-4">
            <TabsList className="grid w-full grid-cols-3 md:w-[450px]">
                <TabsTrigger value="all"><Filter className="mr-2 h-4 w-4 opacity-70"/>All Entries</TabsTrigger>
                <TabsTrigger value="sales"><Users className="mr-2 h-4 w-4 opacity-70"/>Sales</TabsTrigger>
                <TabsTrigger value="purchases"><Truck className="mr-2 h-4 w-4 opacity-70"/>Purchases</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading && displayedLedgerEntries.length === 0 ? <p className="text-center text-muted-foreground py-4">Loading entries...</p> 
          : displayedLedgerEntries.length === 0 ? <p  className="text-center text-muted-foreground py-4">No ledger entries found for this date {ledgerSearchTerm && `matching "${ledgerSearchTerm}"`}.</p> 
          : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Type</TableHead><TableHead>Entity</TableHead><TableHead className="min-w-[200px]">Items</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total (₹)</TableHead>
                  <TableHead>Payment</TableHead><TableHead>Notes</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {displayedLedgerEntries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge variant={entry.type === 'sale' ? 'default' : 'secondary'} className={entry.type === 'sale' ? 'bg-green-100 text-green-700 dark:bg-green-700 dark:text-green-100' : 'bg-blue-100 text-blue-700 dark:bg-blue-700 dark:text-blue-100'}>
                            {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{entry.entityName}</TableCell>
                      <TableCell>{entry.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.subTotal)}</TableCell>
                      <TableCell className="text-right">{entry.gstApplied ? formatCurrency(entry.taxAmount) : "N/A"}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(entry.grandTotal)}</TableCell>
                      <TableCell className="capitalize">{entry.paymentStatus} {entry.paymentMethod ? `(${entry.paymentMethod})` : ''}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate" title={entry.notes || undefined}>{entry.notes || "N/A"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

