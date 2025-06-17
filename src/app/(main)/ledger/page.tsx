
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BookOpen, PlusCircle, Trash2, Search, Users, Truck, XCircle, Filter, FileWarning, Calculator, Edit, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, where, doc, runTransaction, Timestamp, deleteDoc, getDoc } from 'firebase/firestore';
import type { DocumentSnapshot, DocumentData, DocumentReference } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
import type { Customer } from './../customers/page';
import type { Seller } from './../sellers/page';
import type { Product } from './../products/page';
import { format, parseISO } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import type { PaymentRecord, PAYMENT_METHODS as PAYMENT_METHODS_PAYMENT_PAGE, PAYMENT_STATUSES as PAYMENT_STATUSES_PAYMENT_PAGE } from './../payments/page';


/**
 * @fileOverview Daily Ledger page for recording sales and purchases.
 * Allows selection of existing customers/sellers or adding new ones on the fly.
 * Supports "Unknown Customer" for cash sales and "Unknown Seller" for cash purchases.
 * Integrates with product stock, updating Firestore.
 * Price editing for ledger items is admin-only. Optional GST application.
 * Payment method is conditionally displayed based on payment status.
 * Automatically creates a PaymentRecord if ledger entry is Paid or Partial.
 * Admins can edit and delete ledger entries, with stock and payment records adjusted accordingly.
 * Data is fetched from and saved to Firebase Firestore.
 */

export interface LedgerItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitOfMeasure: string;
}

const PAYMENT_METHODS_LEDGER = ["Cash", "UPI", "Card", "Bank Transfer", "Credit", "Other"] as const;
const PAYMENT_STATUSES_LEDGER = ['paid', 'pending', 'partial'] as const;

export interface LedgerEntry {
  id: string; 
  date: string; // ISO Date String
  type: 'sale' | 'purchase';
  entityType: 'customer' | 'seller' | 'unknown_customer' | 'unknown_seller';
  entityId: string | null;
  entityName: string;
  items: LedgerItem[];
  subTotal: number;
  gstApplied: boolean;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: typeof PAYMENT_METHODS_LEDGER[number] | null;
  paymentStatus: typeof PAYMENT_STATUSES_LEDGER[number];
  notes: string | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  originalTransactionAmount: number; 
  amountPaidNow: number; 
  remainingAmount: number; 
  associatedPaymentRecordId?: string | null; 
}

const ledgerItemSchema = z.object({
  productId: z.string().min(1, "Product selection is required."),
  productName: z.string(),
  quantity: z.number().min(0.01, "Quantity must be greater than 0."),
  unitPrice: z.number().min(0, "Unit price cannot be negative."),
  totalPrice: z.number(),
  unitOfMeasure: z.string(),
});

const baseLedgerEntrySchema = z.object({
  date: z.string().refine(val => !isNaN(parseISO(val).valueOf()), { message: "A valid date is required." }),
  type: z.enum(['sale', 'purchase'], { required_error: "Transaction type is required." }),
  entityType: z.enum(['customer', 'seller', 'unknown_customer', 'unknown_seller'], { required_error: "Entity type is required." }),
  entityId: z.string().nullable().optional().transform(val => (val === undefined || val === "") ? null : val),
  entityName: z.string().min(1, "Entity name is required."),
  items: z.array(ledgerItemSchema).min(1, "At least one item must be added to the ledger."),
  applyGst: z.boolean().default(false),
  paymentStatus: z.enum(PAYMENT_STATUSES_LEDGER, { required_error: "Payment status is required."}),
  paymentMethod: z.enum(PAYMENT_METHODS_LEDGER).nullable().optional().transform(val => (val === undefined || val === "") ? null : val),
  amountPaidNow: z.preprocess(
    (val) => {
      if (val === undefined || val === null || String(val).trim() === "") {
        return undefined; 
      }
      const num = parseFloat(String(val).replace(/[^0-9.]+/g, ""));
      return isNaN(num) ? undefined : num;
    },
    z.number({ invalid_type_error: "Amount paid now must be a valid number if provided." })
      .nonnegative({ message: "Amount paid now cannot be negative if provided." })
      .optional()
  ),
  notes: z.string().optional().transform(value => (value === undefined || value.trim() === "") ? null : value.trim()),
});

const GST_RATE = 0.18; 

const ledgerEntrySchema = baseLedgerEntrySchema.superRefine((data, ctx) => {
  if ((data.paymentStatus === "paid" || data.paymentStatus === "partial") && !data.paymentMethod) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Payment method is required for Paid or Partial status.",
      path: ["paymentMethod"],
    });
  }

  const subTotal = data.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
  const grandTotal = subTotal * (data.applyGst ? (1 + GST_RATE) : 1);

  if (data.paymentStatus === "partial") {
    if (data.amountPaidNow === undefined || data.amountPaidNow <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount paid now is required for partial payments and must be positive.", path: ["amountPaidNow"] });
    }
    if (data.amountPaidNow && data.amountPaidNow >= grandTotal && grandTotal > 0) { 
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "For partial payment, amount paid must be less than the grand total.", path: ["amountPaidNow"] });
    }
  }
});

type LedgerFormValues = z.infer<typeof ledgerEntrySchema>;

const newCustomerSellerSchema = z.object({ name: z.string().min(2, "Name requires at least 2 chars."), phone: z.string().min(10, "Phone requires at least 10 digits.") });
type NewCustomerSellerFormValues = z.infer<typeof newCustomerSellerSchema>;


const getCookie = (name: string): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

export default function DailyLedgerPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [isLedgerFormOpen, setIsLedgerFormOpen] = useState(false);
  const [editingLedgerEntry, setEditingLedgerEntry] = useState<LedgerEntry | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [ledgerEntryToDelete, setLedgerEntryToDelete] = useState<LedgerEntry | null>(null);

  const [isNewEntityDialogOpen, setIsNewEntityDialogOpen] = useState(false);
  const [newEntityType, setNewEntityType] = useState<'customer' | 'seller'>('customer');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [activeLedgerTab, setActiveLedgerTab] = useState<'all' | 'customer_sales' | 'seller_purchases'>('all');

  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'store_manager' | undefined>();

  useEffect(() => {
    const role = getCookie('userRole');
    if (role === 'admin' || role === 'store_manager') {
      setCurrentUserRole(role as 'admin' | 'store_manager');
    }
  }, []);

  const form = useForm<LedgerFormValues>({
    resolver: zodResolver(ledgerEntrySchema),
    defaultValues: {
      date: selectedDate, type: 'sale', entityType: 'customer', entityName: '',
      items: [], applyGst: false,
      paymentStatus: 'paid', paymentMethod: 'Cash',
      amountPaidNow: undefined, 
      notes: null, 
      entityId: null,
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
        return { id: d.id, ...data, displayPrice: formatCurrency(data.numericPrice || 0) } as Product;
      }));
      setLedgerEntries(entrySnap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id, 
            ...data,
            paymentMethod: data.paymentMethod || null,
            paymentStatus: data.paymentStatus || 'pending',
            notes: data.notes || null,
            entityId: data.entityId || null,
            originalTransactionAmount: data.originalTransactionAmount || data.grandTotal || 0,
            amountPaidNow: typeof data.amountPaidNow === 'number' ? data.amountPaidNow : (data.paymentStatus === 'paid' ? data.grandTotal : 0),
            remainingAmount: typeof data.remainingAmount === 'number' ? data.remainingAmount : (data.grandTotal - (typeof data.amountPaidNow === 'number' ? data.amountPaidNow : (data.paymentStatus === 'paid' ? data.grandTotal : 0))),
            associatedPaymentRecordId: data.associatedPaymentRecordId || null,
        } as LedgerEntry;
      }));

    } catch (error: any) {
      console.error("Error fetching data for ledger:", error);
      if (error.code === 'failed-precondition') {
        toast({
            title: "Database Index Required",
            description: `A query for ledger data failed. Firestore index 'ledgerEntries' (date ASC, createdAt DESC) or other collection index likely needed. Check console for exact link.`,
            variant: "destructive", duration: 15000,
        });
      } else {
        toast({ title: "Data Load Error", description: "Could not load required data for the ledger. Please try again.", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast, formatCurrency]);

  useEffect(() => { fetchData(selectedDate); }, [selectedDate, fetchData]);
  
  useEffect(() => { 
    if (!isLedgerFormOpen) { 
        if (!editingLedgerEntry) { 
             form.setValue("date", selectedDate);
        }
    }
  }, [selectedDate, form, isLedgerFormOpen, editingLedgerEntry]);

  useEffect(() => {
    if (isLedgerFormOpen) {
      if (editingLedgerEntry) {
         form.reset({
            date: editingLedgerEntry.date, 
            type: editingLedgerEntry.type,
            entityType: editingLedgerEntry.entityType,
            entityId: editingLedgerEntry.entityId,
            entityName: editingLedgerEntry.entityName,
            items: editingLedgerEntry.items.map(item => ({...item})), 
            applyGst: editingLedgerEntry.gstApplied,
            paymentStatus: editingLedgerEntry.paymentStatus,
            paymentMethod: editingLedgerEntry.paymentMethod,
            amountPaidNow: editingLedgerEntry.paymentStatus === 'partial' ? editingLedgerEntry.amountPaidNow : undefined,
            notes: editingLedgerEntry.notes || null,
        });
      } else {
        form.reset({
            date: selectedDate, 
            type: 'sale', 
            entityType: 'customer', 
            entityName: '',
            items: [], 
            applyGst: false,
            paymentStatus: 'paid', 
            paymentMethod: 'Cash',
            amountPaidNow: undefined,
            notes: null, 
            entityId: null,
        });
      }
    }
  }, [editingLedgerEntry, isLedgerFormOpen, form, selectedDate]);


  const transactionTypeWatcher = form.watch("type");
  useEffect(() => {
    if (!editingLedgerEntry && form.formState.isDirty && form.getFieldState("type").isDirty) { 
        if (transactionTypeWatcher === 'sale') {
            form.setValue("entityType", 'customer', { shouldDirty: true });
            form.setValue("paymentStatus", 'paid', { shouldDirty: true }); 
            form.setValue("paymentMethod", 'Cash', { shouldDirty: true });
        } else { 
            form.setValue("entityType", 'seller', { shouldDirty: true });
            form.setValue("paymentStatus", 'pending', { shouldDirty: true }); 
            form.setValue("paymentMethod", null, { shouldDirty: true });
        }
        form.setValue("entityId", null, { shouldDirty: true });
        form.setValue("entityName", "", { shouldDirty: true });
        form.setValue("amountPaidNow", undefined, { shouldDirty: true });
        form.clearErrors("amountPaidNow");
        form.clearErrors("paymentMethod");
    }
  }, [transactionTypeWatcher, form, editingLedgerEntry]);


  const entityTypeWatcher = form.watch("entityType");
  useEffect(() => {
     if (!editingLedgerEntry && form.formState.isDirty && form.getFieldState("entityType").isDirty) {
        if (entityTypeWatcher === "unknown_customer") {
            form.setValue("entityId", null, { shouldDirty: true });
            form.setValue("entityName", "Unknown Customer", { shouldDirty: true });
            form.setValue("paymentStatus", "paid", { shouldDirty: true });
            form.setValue("paymentMethod", "Cash", { shouldDirty: true });
        } else if (entityTypeWatcher === "unknown_seller") {
            form.setValue("entityId", null, { shouldDirty: true });
            form.setValue("entityName", "Unknown Seller", { shouldDirty: true });
            form.setValue("paymentStatus", "paid", { shouldDirty: true }); 
            form.setValue("paymentMethod", "Cash", { shouldDirty: true });
        } else if ((form.getValues("entityName") === "Unknown Customer" || form.getValues("entityName") === "Unknown Seller") &&
                (entityTypeWatcher === "customer" || entityTypeWatcher === "seller")) {
            form.setValue("entityName", "", { shouldDirty: true });
            form.setValue("entityId", null, { shouldDirty: true }); 
            if(form.getValues("type") === 'sale') {
                form.setValue("paymentStatus", "paid", { shouldDirty: true });
                form.setValue("paymentMethod", "Cash", { shouldDirty: true });
            } else { 
                form.setValue("paymentStatus", "pending", { shouldDirty: true });
                form.setValue("paymentMethod", null, { shouldDirty: true });
            }
        }
        form.clearErrors("paymentMethod");
     }
  }, [entityTypeWatcher, form, editingLedgerEntry]);

  const paymentStatusWatcher = form.watch("paymentStatus");
  const shouldShowPaymentMethod = paymentStatusWatcher === "paid" || paymentStatusWatcher === "partial";
  const isPartialPayment = paymentStatusWatcher === "partial";

  useEffect(() => {
    if (form.formState.isDirty || editingLedgerEntry) {
        if (!shouldShowPaymentMethod) {
            form.setValue("paymentMethod", null, { shouldDirty: true });
        } else if (shouldShowPaymentMethod && !form.getValues("paymentMethod")) {
            if(form.getValues("type") === 'sale' || entityTypeWatcher === "unknown_seller" || entityTypeWatcher === "unknown_customer") {
                form.setValue("paymentMethod", 'Cash', { shouldDirty: true });
            }
        }
        if (paymentStatusWatcher !== 'partial') {
            form.setValue("amountPaidNow", undefined, { shouldDirty: true });
            form.clearErrors("amountPaidNow"); 
        } else {
           if(form.getValues("amountPaidNow") === undefined && form.getFieldState("amountPaidNow").isDirty) {
              form.trigger("amountPaidNow");
           }
        }
        form.clearErrors("paymentMethod"); 
    }
  }, [shouldShowPaymentMethod, paymentStatusWatcher, form, entityTypeWatcher, editingLedgerEntry]);


  const handleAddProductToLedger = (product: Product) => {
    const existingItemIndex = fields.findIndex(item => item.productId === product.id);
    if (existingItemIndex > -1) {
        const currentItem = fields[existingItemIndex];
        if (form.getValues("type") === 'sale' && product.stock > 0 && currentItem.quantity + 1 > product.stock) {
            toast({ title: "Stock Alert", description: `Cannot add more ${product.name}. Max available: ${product.stock}`, variant: "destructive"});
            return;
        }
        update(existingItemIndex, { ...currentItem, quantity: currentItem.quantity + 1, totalPrice: (currentItem.quantity + 1) * currentItem.unitPrice });
    } else {
        if (form.getValues("type") === 'sale' && product.stock <= 0) {
             toast({ title: "Out of Stock", description: `${product.name} is out of stock.`, variant: "destructive"}); return;
        }
        append({ productId: product.id, productName: product.name, quantity: 1, unitPrice: product.numericPrice, totalPrice: product.numericPrice, unitOfMeasure: product.unitOfMeasure });
    }
    setProductSearchTerm('');
  };

  const handleItemQuantityChange = (index: number, quantityStr: string) => {
    const quantity = parseFloat(quantityStr);
    const item = fields[index];
    const productDetails = products.find(p => p.id === item.productId);

    if (isNaN(quantity) || quantity <= 0) { remove(index); return; }

    let newQuantity = quantity;
    if (form.getValues("type") === 'sale' && productDetails && newQuantity > productDetails.stock) {
        toast({ title: "Stock Alert", description: `Quantity for ${item.productName} exceeds stock (${productDetails.stock}). Setting to max.`, variant: "destructive"});
        newQuantity = productDetails.stock;
    }
    form.setValue(`items.${index}.quantity`, newQuantity, { shouldDirty: true });
  };

  const handleItemPriceChange = (index: number, unitPriceStr: string) => {
    if (currentUserRole !== 'admin') {
        toast({ title: "Permission Denied", description: "Only Admins can change item prices directly in the ledger.", variant: "destructive" });
        const item = fields[index]; form.setValue(`items.${index}.unitPrice`, item.unitPrice); return;
    }
    let unitPrice = parseFloat(unitPriceStr);
    if (isNaN(unitPrice) || unitPrice < 0) unitPrice = 0;
    form.setValue(`items.${index}.unitPrice`, unitPrice, { shouldDirty: true });
  };

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
        if (name?.startsWith("items")) {
            form.getValues("items").forEach((item, index) => {
                const newTotal = (item.quantity || 0) * (item.unitPrice || 0);
                if (item.totalPrice !== newTotal) {
                    form.setValue(`items.${index}.totalPrice`, newTotal, { shouldDirty: true });
                }
            });
        }
    });
    return () => subscription.unsubscribe();
  }, [form]); 


  const itemsWatcher = form.watch("items");
  const applyGstWatcher = form.watch("applyGst");
  const amountPaidNowWatcher = form.watch("amountPaidNow");

  const currentSubtotal = itemsWatcher.reduce((acc, item) => acc + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
  const currentTax = applyGstWatcher ? currentSubtotal * GST_RATE : 0;
  const currentGrandTotal = currentSubtotal + currentTax;
  
  let currentAmountPaidNowForDisplay: number;
  if (paymentStatusWatcher === 'paid') {
    currentAmountPaidNowForDisplay = currentGrandTotal;
  } else if (paymentStatusWatcher === 'partial') {
    currentAmountPaidNowForDisplay = amountPaidNowWatcher || 0;
  } else { 
    currentAmountPaidNowForDisplay = 0;
  }
  
  const currentRemainingAmountForDisplay = currentGrandTotal - currentAmountPaidNowForDisplay;


  const onLedgerSubmit = async (data: LedgerFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser) { toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" }); return; }

    const subTotal = data.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
    const taxAmount = data.applyGst ? subTotal * GST_RATE : 0;
    const grandTotal = subTotal + taxAmount;

    let amountPaidForSave: number;
    let remainingAmountForSave: number;

    if (data.paymentStatus === 'paid') {
        amountPaidForSave = grandTotal;
        remainingAmountForSave = 0;
    } else if (data.paymentStatus === 'partial') {
        amountPaidForSave = data.amountPaidNow || 0; 
        remainingAmountForSave = grandTotal - amountPaidForSave;
        if (remainingAmountForSave < 0) remainingAmountForSave = 0;
    } else { 
        amountPaidForSave = 0;
        remainingAmountForSave = grandTotal;
    }

    const ledgerDataForSave: Omit<LedgerEntry, 'id' | 'createdAt' | 'updatedAt' | 'associatedPaymentRecordId'> & { createdAt?: any, updatedAt: any, associatedPaymentRecordId?: string | null } = {
      date: data.date, type: data.type, entityType: data.entityType,
      entityId: data.entityId, 
      entityName: data.entityName, 
      items: data.items.map(item => ({ 
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity || 0,
          unitPrice: item.unitPrice || 0,
          totalPrice: (item.quantity || 0) * (item.unitPrice || 0),
          unitOfMeasure: item.unitOfMeasure,
      })),
      subTotal, gstApplied: data.applyGst, taxAmount, grandTotal,
      paymentMethod: (data.paymentStatus === 'paid' || data.paymentStatus === 'partial') ? (data.paymentMethod) : null, 
      paymentStatus: data.paymentStatus,
      originalTransactionAmount: grandTotal,
      amountPaidNow: amountPaidForSave,
      remainingAmount: remainingAmountForSave,
      notes: data.notes, 
      createdBy: editingLedgerEntry ? editingLedgerEntry.createdBy : currentUser.uid, 
      updatedAt: serverTimestamp(),
    };

    try {
      await runTransaction(db, async (transaction) => {
        let ledgerDocRef: DocumentReference;
        let originalLedgerEntryData: LedgerEntry | null = null;
        let originalAssociatedPaymentRecordId: string | null = null;
        
        // --- READ PHASE ---
        // Read original ledger entry if editing
        if (editingLedgerEntry) {
          ledgerDocRef = doc(db, "ledgerEntries", editingLedgerEntry.id);
          const originalLedgerSnap = await transaction.get(ledgerDocRef);
          if (!originalLedgerSnap.exists()) throw new Error("Original ledger entry not found for editing.");
          originalLedgerEntryData = originalLedgerSnap.data() as LedgerEntry;
          originalAssociatedPaymentRecordId = originalLedgerEntryData.associatedPaymentRecordId || null;
        } else {
          ledgerDocRef = doc(collection(db, "ledgerEntries"));
        }

        // Collect all product IDs involved
        const productIdsInvolved = new Set<string>();
        if (originalLedgerEntryData) {
          originalLedgerEntryData.items.forEach(item => productIdsInvolved.add(item.productId));
        }
        ledgerDataForSave.items.forEach(item => productIdsInvolved.add(item.productId));

        // Read all product documents
        const productSnapshots = new Map<string, DocumentSnapshot<DocumentData>>();
        for (const productId of productIdsInvolved) {
          const productRef = doc(db, "products", productId);
          const productSnap = await transaction.get(productRef);
          if (!productSnap.exists()) {
            const productName = originalLedgerEntryData?.items.find(i => i.productId === productId)?.productName || 
                                ledgerDataForSave.items.find(i => i.productId === productId)?.productName || 
                                `ID: ${productId}`;
            throw new Error(`Product "${productName}" (ID: ${productId}) not found in database.`);
          }
          productSnapshots.set(productId, productSnap);
        }
        // --- END OF READ PHASE ---


        // --- CALCULATION & LOGIC PHASE (No Firestore reads/writes here) ---
        const productStockUpdates: { ref: DocumentReference, newStock: number, previousStock: number, adjustmentValue: number, productName: string, sku: string }[] = [];

        // Calculate stock reversions for original items (if editing)
        if (originalLedgerEntryData) {
          for (const item of originalLedgerEntryData.items) {
            const productSnap = productSnapshots.get(item.productId)!;
            const currentDbStock = productSnap.data()!.stock as number;
            const stockChange = originalLedgerEntryData.type === 'sale' ? item.quantity : -item.quantity;
            const revertedStock = currentDbStock + stockChange;
            // We don't push to productStockUpdates yet, as this is just a reversion.
            // The new stock application below will handle the final update.
            // We need to ensure the *currentDbStock for new calculations reflects this reversion*
            // OR, better, calculate net change.

            // For simplicity in the final write, let's just adjust the stock on the snapshot we have
             productSnapshots.set(item.productId, {
                ...productSnap,
                data: () => ({ ...productSnap.data(), stock: revertedStock })
            } as DocumentSnapshot<DocumentData>);

            // Log the reversion part of the edit
            const stockMovementLogRef = doc(collection(db, "stockMovements"));
            transaction.set(stockMovementLogRef, {
                productId: item.productId, productName: item.productName, sku: productSnap.data()!.sku,
                previousStock: currentDbStock, newStock: revertedStock,
                adjustmentType: 'revert_ledger_edit_item', adjustmentValue: stockChange,
                notes: `Stock for ${item.productName} reverted due to edit of ledger entry ${ledgerDocRef.id}`,
                timestamp: serverTimestamp(), adjustedByUid: currentUser.uid, adjustedByEmail: currentUser.email || "N/A",
                ledgerEntryId: ledgerDocRef.id,
            });
          }
        }
        
        // Calculate new stock levels for items in the current form data
        for (const item of ledgerDataForSave.items) {
          const productSnap = productSnapshots.get(item.productId)!; // Should exist from pre-fetch
          // If editing, currentDbStock is the *reverted* stock from above. If new, it's the fresh stock.
          const currentDbStock = productSnap.data()!.stock as number; 
          
          let newStock = ledgerDataForSave.type === 'sale' ? currentDbStock - item.quantity : currentDbStock + item.quantity;
          if (ledgerDataForSave.type === 'sale' && newStock < 0) {
             throw new Error(`Insufficient stock for ${item.productName}. Available after potential reversion: ${currentDbStock}, Requested: ${item.quantity}.`);
          }
          if (newStock < 0 && ledgerDataForSave.type === 'sale') newStock = 0;

          productStockUpdates.push({ 
            ref: productSnap.ref, newStock: newStock, 
            previousStock: currentDbStock, // Stock before this item's application
            adjustmentValue: ledgerDataForSave.type === 'sale' ? -item.quantity : item.quantity,
            productName: item.productName,
            sku: productSnap.data()!.sku
          });
        }
        // --- END OF CALCULATION PHASE ---


        // --- WRITE PHASE ---
        // Delete old payment record (if editing and one existed)
        if (editingLedgerEntry && originalAssociatedPaymentRecordId) {
            const oldPaymentRef = doc(db, "payments", originalAssociatedPaymentRecordId);
            transaction.delete(oldPaymentRef);
        }
        
        // Create new payment record if needed
        let newAssociatedPaymentRecordId: string | null = null;
        if (ledgerDataForSave.paymentStatus === 'paid' || ledgerDataForSave.paymentStatus === 'partial') {
          const paymentRecordRef = doc(collection(db, "payments"));
          newAssociatedPaymentRecordId = paymentRecordRef.id;
          const paymentData: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt' | 'displayAmountPaid'> & {createdAt: any, updatedAt?: any, ledgerEntryId: string} = {
            type: ledgerDataForSave.type === 'sale' ? 'customer' : 'supplier',
            relatedEntityName: ledgerDataForSave.entityName,
            relatedEntityId: ledgerDataForSave.entityId || `unknown-${ledgerDataForSave.entityType}-${Date.now()}`,
            relatedInvoiceId: null, 
            date: format(parseISO(ledgerDataForSave.date), "MMM dd, yyyy"), 
            isoDate: ledgerDataForSave.date, 
            amountPaid: amountPaidForSave,
            originalInvoiceAmount: grandTotal, 
            remainingBalanceOnInvoice: remainingAmountForSave,
            method: ledgerDataForSave.paymentMethod as typeof PAYMENT_METHODS_PAYMENT_PAGE[number] | null,
            transactionId: null, 
            status: ledgerDataForSave.paymentStatus === 'paid' ? 'Completed' : 'Partial' as typeof PAYMENT_STATUSES_PAYMENT_PAGE[number],
            notes: `Payment for Ledger Entry: ${ledgerDocRef.id}. ${ledgerDataForSave.notes || ''}`.trim(),
            ledgerEntryId: ledgerDocRef.id,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          transaction.set(paymentRecordRef, paymentData);
        }

        // Update product stocks and log movements
        for (const pu of productStockUpdates) {
            transaction.update(pu.ref, { stock: pu.newStock, updatedAt: serverTimestamp() });
            
            const stockMovementLogRef = doc(collection(db, "stockMovements"));
            transaction.set(stockMovementLogRef, {
                productId: pu.ref.id, productName: pu.productName, sku: pu.sku,
                previousStock: pu.previousStock, newStock: pu.newStock,
                adjustmentType: ledgerDataForSave.type === 'sale' ? 'sale_ledger_entry' : 'purchase_ledger_entry',
                adjustmentValue: pu.adjustmentValue,
                notes: `Stock ${editingLedgerEntry ? 'updated by edit of' : 'adjusted by'} ledger entry ${ledgerDocRef.id}`,
                timestamp: serverTimestamp(), adjustedByUid: currentUser.uid, adjustedByEmail: currentUser.email || "N/A",
                ledgerEntryId: ledgerDocRef.id,
            });
        }
        
        // Set/Update ledger entry
        const finalLedgerDataToCommit = {
            ...ledgerDataForSave,
            associatedPaymentRecordId: newAssociatedPaymentRecordId,
            ...(editingLedgerEntry ? {} : { createdAt: serverTimestamp() }) 
        };
        
        if (editingLedgerEntry) {
            transaction.update(ledgerDocRef, finalLedgerDataToCommit);
        } else {
            transaction.set(ledgerDocRef, finalLedgerDataToCommit);
        }
        // --- END OF WRITE PHASE ---
      });

      toast({ title: editingLedgerEntry ? "Ledger Entry Updated" : "Ledger Entry Saved", description: "Transaction recorded, stock updated, and payment record handled." });
      form.reset({ date: selectedDate, type: 'sale', entityType: 'customer', entityName: '', items: [], applyGst: false, paymentStatus: 'paid', paymentMethod: 'Cash', amountPaidNow: undefined, notes: null, entityId: null });
      setIsLedgerFormOpen(false);
      setEditingLedgerEntry(null);
      fetchData(selectedDate);
      setProductSearchTerm('');
    } catch (error: any) {
      console.error("Error saving ledger entry:", error);
      toast({ title: "Save Error", description: error.message || "Failed to save ledger entry. Please check details and try again.", variant: "destructive" });
    }
  };

  const onNewEntitySubmit = async (data: NewCustomerSellerFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser) { toast({ title: "Auth Error", description: "Please log in.", variant: "destructive" }); return; }
    const collectionName = newEntityType === 'customer' ? "customers" : "sellers";
    try {
      const docRef = await addDoc(collection(db, collectionName), {
          ...data, createdAt: serverTimestamp(), email: "",
          ...(newEntityType === 'customer' && { totalSpent: "₹0.00", createdBy: currentUser.uid })
      });
      toast({ title: `${newEntityType.charAt(0).toUpperCase() + newEntityType.slice(1)} Added`, description: `${data.name} has been added.` });
      setIsNewEntityDialogOpen(false); newEntityForm.reset();

      if (newEntityType === 'customer') {
        const custSnap = await getDocs(query(collection(db, "customers"), orderBy("name")));
        setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
      } else {
        const sellSnap = await getDocs(query(collection(db, "sellers"), orderBy("name")));
        setSellers(sellSnap.docs.map(d => ({ id: d.id, ...d.data() } as Seller)));
      }
      form.setValue("entityId", docRef.id); form.setValue("entityName", data.name);
    } catch (error: any) {
      toast({ title: `Error Adding ${newEntityType}`, description: error.message || `Failed to add new ${newEntityType}.`, variant: "destructive" });
    }
  };

  const handleEditLedgerEntry = (entry: LedgerEntry) => {
    if (currentUserRole !== 'admin') {
        toast({title: "Permission Denied", description: "Store managers cannot edit ledger entries directly.", variant: "destructive"});
        return;
    }
    setEditingLedgerEntry(entry);
    setIsLedgerFormOpen(true);
  };

  const openDeleteConfirmation = (entry: LedgerEntry) => {
    if (currentUserRole !== 'admin') {
        toast({title: "Permission Denied", description: "Only admins can delete ledger entries.", variant: "destructive"});
        return;
    }
    setLedgerEntryToDelete(entry);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteLedgerEntry = async () => {
    if (!ledgerEntryToDelete || currentUserRole !== 'admin') return;
    const currentUser = auth.currentUser;
     if (!currentUser) { toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" }); return; }

    try {
        await runTransaction(db, async (transaction) => {
            const ledgerDocRef = doc(db, "ledgerEntries", ledgerEntryToDelete.id);
            const ledgerSnap = await transaction.get(ledgerDocRef);
            if (!ledgerSnap.exists()) throw new Error("Ledger entry not found for deletion.");
            const entryData = ledgerSnap.data() as LedgerEntry;

            // --- READ PHASE ---
            // Collect all product IDs
            const productIdsInvolved = new Set<string>();
            entryData.items.forEach(item => productIdsInvolved.add(item.productId));

            // Read all product documents
            const productSnapshots = new Map<string, DocumentSnapshot<DocumentData>>();
            for (const productId of productIdsInvolved) {
                const productRef = doc(db, "products", productId);
                const productSnap = await transaction.get(productRef);
                if (!productSnap.exists()) throw new Error(`Product from entry not found (ID: ${productId}).`);
                productSnapshots.set(productId, productSnap);
            }
            // --- END OF READ PHASE ---

            // --- WRITE PHASE ---
            for (const item of entryData.items) {
                const productSnap = productSnapshots.get(item.productId)!;
                const currentDbStock = productSnap.data()!.stock as number;
                const stockChange = entryData.type === 'sale' ? item.quantity : -item.quantity; 
                const revertedStock = currentDbStock + stockChange;
                transaction.update(productSnap.ref, { stock: revertedStock, updatedAt: serverTimestamp() });

                const stockMovementLogRef = doc(collection(db, "stockMovements"));
                transaction.set(stockMovementLogRef, {
                    productId: item.productId, productName: item.productName, sku: productSnap.data()!.sku,
                    previousStock: currentDbStock, newStock: revertedStock,
                    adjustmentType: 'revert_ledger_delete', adjustmentValue: stockChange,
                    notes: `Stock reverted due to deletion of ledger entry ${ledgerEntryToDelete.id}`,
                    timestamp: serverTimestamp(), adjustedByUid: currentUser.uid, adjustedByEmail: currentUser.email || "N/A",
                    ledgerEntryId: ledgerEntryToDelete.id,
                });
            }

            if (entryData.associatedPaymentRecordId) {
                const paymentRef = doc(db, "payments", entryData.associatedPaymentRecordId);
                transaction.delete(paymentRef);
            }

            transaction.delete(ledgerDocRef);
             // --- END OF WRITE PHASE ---
        });
        toast({ title: "Ledger Entry Deleted", description: `Entry ID ${ledgerEntryToDelete.id.substring(0,6)}... and associated records deleted.` });
        fetchData(selectedDate); 
    } catch (error: any) {
        console.error("Error deleting ledger entry:", error);
        toast({ title: "Deletion Error", description: error.message || "Failed to delete ledger entry.", variant: "destructive" });
    } finally {
        setIsDeleteConfirmOpen(false);
        setLedgerEntryToDelete(null);
    }
  };


  const filteredProducts = productSearchTerm
    ? products.filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(productSearchTerm.toLowerCase())))
    : [];

  const displayedLedgerEntries = ledgerEntries
    .filter(entry => {
        if (activeLedgerTab === 'customer_sales') return entry.type === 'sale';
        if (activeLedgerTab === 'seller_purchases') return entry.type === 'purchase';
        return true; 
    })
    .filter(entry => {
        if (!ledgerSearchTerm) return true;
        const searchTermLower = ledgerSearchTerm.toLowerCase();
        const matchesEntity = entry.entityName.toLowerCase().includes(searchTermLower);
        const matchesItems = entry.items.some(item =>
            item.productName.toLowerCase().includes(searchTermLower) ||
            item.quantity.toString().includes(searchTermLower) ||
            formatCurrency(item.unitPrice).toLowerCase().includes(searchTermLower) ||
            formatCurrency(item.totalPrice).toLowerCase().includes(searchTermLower)
        );
        const matchesNotes = entry.notes ? entry.notes.toLowerCase().includes(searchTermLower) : false;
        const matchesPaymentMethod = entry.paymentMethod ? entry.paymentMethod.toLowerCase().includes(searchTermLower) : false;
        const matchesId = entry.id.toLowerCase().includes(searchTermLower);
        return matchesEntity || matchesItems || matchesNotes || matchesPaymentMethod || matchesId;
    });

  if (isLoading && !customers.length && !products.length && !sellers.length && !ledgerEntries.length) {
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
                setEditingLedgerEntry(null);
                setIsLedgerFormOpen(true);
            }}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Ledger Entry
            </Button>
        }
      />

      <Dialog open={isLedgerFormOpen} onOpenChange={(isOpen) => {
          if (!isOpen) { 
            setProductSearchTerm(''); 
            setEditingLedgerEntry(null); 
            form.reset({ date: selectedDate, type: 'sale', entityType: 'customer', entityName: '', items: [], applyGst: false, paymentStatus: 'paid', paymentMethod: 'Cash', amountPaidNow: undefined, notes: null, entityId: null });
          }
          setIsLedgerFormOpen(isOpen);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingLedgerEntry ? `Edit Ledger Entry (ID: ${editingLedgerEntry.id.substring(0,6)}...)` : "New Ledger Entry"}</DialogTitle>
            <DialogDescription>Fill in the details for the transaction. {editingLedgerEntry ? "Admins can modify existing entries." : ""}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onLedgerSubmit)} className="max-h-[75vh] overflow-y-auto pr-4">
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem><FormLabel>Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!!editingLedgerEntry}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent><SelectItem value="sale">Sale / Stock Out</SelectItem><SelectItem value="purchase">Purchase / Stock In</SelectItem></SelectContent>
                          </Select><FormMessage />
                      </FormItem>)} />
                  <FormField control={form.control} name="entityType" render={({ field }) => (
                      <FormItem><FormLabel>{form.getValues("type") === 'sale' ? 'Customer Type' : 'Seller Type'}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!!editingLedgerEntry}>
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
                                      field.onChange(value || null); 
                                      const selectedEntity = (form.getValues("type") === 'sale' ? customers : sellers).find(e => e.id === value);
                                      form.setValue("entityName", selectedEntity?.name || "");
                                  }}
                                  value={field.value || ""}
                                  disabled={!!editingLedgerEntry && form.getValues("entityType") !== 'unknown_customer' && form.getValues("entityType") !== 'unknown_seller'}
                              >
                                  <FormControl><SelectTrigger><SelectValue placeholder={`Select existing ${form.getValues("type") === 'sale' ? 'customer' : 'seller'}`} /></SelectTrigger></FormControl>
                                  <SelectContent>
                                      {(form.getValues("type") === 'sale' ? customers : sellers).map(e => <SelectItem key={e.id} value={e.id}>{e.name} {e.phone ? `(${e.phone})` : ''}</SelectItem>)}
                                  </SelectContent>
                              </Select><FormMessage />
                          </FormItem>)} />
                       <Button type="button" variant="outline" onClick={() => { setNewEntityType(form.getValues("type") === 'sale' ? 'customer' : 'seller'); setIsNewEntityDialogOpen(true); }} disabled={!!editingLedgerEntry}>
                          <PlusCircle className="mr-2 h-4 w-4" /> Add New {form.getValues("type") === 'sale' ? 'Customer' : 'Seller'}
                      </Button>
                  </div>
                )}
                 <FormField control={form.control} name="entityName" render={({ field }) => (<FormItem className={((form.getValues("entityType") === "unknown_customer" || form.getValues("entityType") === "unknown_seller") || (!!editingLedgerEntry && (editingLedgerEntry.entityType === 'unknown_customer' || editingLedgerEntry.entityType === 'unknown_seller')) ) ? "" : "hidden"}><FormLabel>Entity Name</FormLabel><FormControl><Input {...field} readOnly /></FormControl><FormMessage /></FormItem>)} />

                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-lg font-medium">Items</Label>
                   <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search products by name or SKU..." className="pl-8" value={productSearchTerm} onChange={e => setProductSearchTerm(e.target.value)} />
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
                                  <FormItem><FormLabel className="text-xs">Qty</FormLabel>
                                    <FormControl><Input type="number" {...f} onChange={e => { f.onChange(parseFloat(e.target.value) || 0); handleItemQuantityChange(index, e.target.value); }} placeholder="Qty" aria-label="Quantity"/></FormControl>
                                  <FormMessage/></FormItem>)} />
                          <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field: f }) => (
                                  <FormItem><FormLabel className="text-xs">Price (₹)</FormLabel>
                                    <FormControl><Input type="number" {...f} onChange={e => { f.onChange(parseFloat(e.target.value) || 0); handleItemPriceChange(index, e.target.value); }} placeholder="Price/Unit" aria-label="Unit Price" disabled={currentUserRole !== 'admin'}/></FormControl>
                                  <FormMessage/></FormItem>)} />
                          <FormItem><FormLabel className="text-xs">Total (₹)</FormLabel><Input value={formatCurrency((form.getValues(`items.${index}.quantity`) || 0) * (form.getValues(`items.${index}.unitPrice`) || 0))} readOnly placeholder="Total" aria-label="Total Price"/></FormItem>
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
                          <FormLabel>Apply GST ({GST_RATE*100}%)</FormLabel>
                          <FormDescription>Calculate and add GST to this transaction.</FormDescription>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />

                <div className="pt-4 border-t space-y-3">
                   <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium">{formatCurrency(currentSubtotal)}</span></div>
                   {applyGstWatcher && <div className="flex justify-between"><span className="text-muted-foreground">Tax (GST {GST_RATE*100}%):</span><span className="font-medium">{formatCurrency(currentTax)}</span></div>}
                   <div className="flex justify-between text-lg font-bold"><span >Grand Total:</span><span>{formatCurrency(currentGrandTotal)}</span></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="paymentStatus" render={({ field }) => (
                      <FormItem><FormLabel>Payment Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                              <SelectContent>
                                  {PAYMENT_STATUSES_LEDGER.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                              </SelectContent>
                          </Select><FormMessage />
                      </FormItem>)} />
                  {shouldShowPaymentMethod && (
                    <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                        <FormItem><FormLabel>Payment Method</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {PAYMENT_METHODS_LEDGER.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                </SelectContent>
                            </Select><FormMessage />
                        </FormItem>)} />
                  )}
                </div>
                {isPartialPayment && (
                    <>
                        <FormItem><FormLabel className="text-sm">Original Transaction Amount</FormLabel><Input value={formatCurrency(currentGrandTotal)} readOnly className="bg-muted/50" /></FormItem>
                        <FormField control={form.control} name="amountPaidNow" render={({ field }) => (
                            <FormItem><FormLabel>Amount Paid Now (₹)</FormLabel>
                                <FormControl><Input type="number" step="0.01" placeholder="e.g., 500.00" {...field} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} value={field.value ?? ""} /></FormControl>
                                <FormMessage />
                            </FormItem>)} />
                        <FormItem><FormLabel className="text-sm">Remaining Amount</FormLabel><Input value={formatCurrency(currentRemainingAmountForDisplay < 0 ? 0 : currentRemainingAmountForDisplay)} readOnly className="bg-muted/50" /></FormItem>
                    </>
                )}

                <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Input placeholder="Any specific notes for this transaction..." {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              </CardContent>
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 border-t -mx-6 px-6">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isLoading || fields.length === 0 || form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (editingLedgerEntry ? "Saving Changes..." : "Saving Ledger Entry...") : (editingLedgerEntry ? "Save Changes" : "Save Ledger Entry")}
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
          <Form {...newEntityForm}><form onSubmit={newEntityForm.handleSubmit(onNewEntitySubmit)} className="space-y-4 py-2">
            <FormField control={newEntityForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder={`${newEntityType} full name`} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={newEntityForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder={`${newEntityType} phone number`} {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter className="pt-4"><DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose><Button type="submit" disabled={newEntityForm.formState.isSubmitting}>{newEntityForm.formState.isSubmitting ? "Adding..." : `Add ${newEntityType.charAt(0).toUpperCase() + newEntityType.slice(1)}`}</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setLedgerEntryToDelete(null); setIsDeleteConfirmOpen(isOpen);}}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the ledger entry for 
                    &quot;{ledgerEntryToDelete?.entityName}&quot; (ID: {ledgerEntryToDelete?.id.substring(0,6)}...) 
                    and revert associated stock changes. If a payment record was auto-created by this ledger entry, it will also be deleted.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => {setIsDeleteConfirmOpen(false); setLedgerEntryToDelete(null);}}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDeleteLedgerEntry} className="bg-destructive hover:bg-destructive/90" disabled={currentUserRole !== 'admin'}>
                    Delete Entry
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <Card className="mt-6 shadow-lg rounded-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="font-headline text-foreground">Ledger Entries for {format(parseISO(selectedDate), "MMMM dd, yyyy")}</CardTitle>
              <CardDescription>Browse recorded transactions for the selected date. Admins can edit/delete.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                 <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full sm:w-auto h-10"/>
                 <div className="relative w-full sm:w-64">
                     <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                     <Input placeholder="Search by ID, entity, product..." className="pl-8 h-10" value={ledgerSearchTerm} onChange={e => setLedgerSearchTerm(e.target.value)} />
                 </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeLedgerTab} onValueChange={(value) => setActiveLedgerTab(value as any)} className="w-full mb-4">
            <TabsList className="grid w-full grid-cols-3 md:w-auto md:max-w-lg">
                <TabsTrigger value="all"><Filter className="mr-2 h-4 w-4 opacity-70"/>All Entries</TabsTrigger>
                <TabsTrigger value="customer_sales"><Users className="mr-2 h-4 w-4 opacity-70"/>Customer (Sales)</TabsTrigger>
                <TabsTrigger value="seller_purchases"><Truck className="mr-2 h-4 w-4 opacity-70"/>Seller (Purchases)</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading && displayedLedgerEntries.length === 0 && !ledgerSearchTerm ? (
            <div className="text-center py-10 text-muted-foreground">
              <BookOpen className="mx-auto h-12 w-12 mb-4" />
              Loading entries...
            </div>
            ) : displayedLedgerEntries.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
                <FileWarning className="mx-auto h-12 w-12 mb-4" />
                <p className="text-xl font-semibold">No Ledger Entries Found</p>
                <p className="text-sm">
                    {ledgerSearchTerm
                        ? `No entries match your search for "${ledgerSearchTerm}" on this date.`
                        : `There are no ledger entries recorded for ${format(parseISO(selectedDate), "MMMM dd, yyyy")}.`
                    }
                </p>
                 <Button onClick={() => { setEditingLedgerEntry(null); setIsLedgerFormOpen(true); }} className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add First Entry for this Date
                </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Type</TableHead><TableHead>Entity</TableHead><TableHead className="min-w-[200px]">Items</TableHead>
                  <TableHead className="text-right">Total (₹)</TableHead>
                  <TableHead className="text-right">Paid (₹)</TableHead>
                  <TableHead className="text-right">Due (₹)</TableHead>
                  <TableHead>Payment</TableHead><TableHead>Notes</TableHead>
                  {currentUserRole === 'admin' && <TableHead className="text-right">Actions</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {displayedLedgerEntries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge variant={entry.type === 'sale' ? 'default' : 'secondary'} className={entry.type === 'sale' ? 'bg-green-100 text-green-700 dark:bg-green-700/80 dark:text-green-100' : 'bg-blue-100 text-blue-700 dark:bg-blue-700/80 dark:text-blue-100'}>
                            {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{entry.entityName}</TableCell>
                      <TableCell>{entry.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(entry.grandTotal)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.amountPaidNow)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.remainingAmount)}</TableCell>
                      <TableCell className="capitalize">
                        {entry.paymentStatus ? entry.paymentStatus.charAt(0).toUpperCase() + entry.paymentStatus.slice(1) : "N/A"}
                        {entry.paymentMethod ? ` (${entry.paymentMethod})` : ''}
                      </TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate" title={entry.notes || undefined}>{entry.notes || "N/A"}</TableCell>
                       {currentUserRole === 'admin' && (
                        <TableCell className="text-right">
                           <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Actions for {entry.id}</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditLedgerEntry(entry)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit Entry
                              </DropdownMenuItem>
                              <DropdownMenuSeparator/>
                              <DropdownMenuItem onClick={() => openDeleteConfirmation(entry)} className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground">
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Entry
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
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

