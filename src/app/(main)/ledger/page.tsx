

"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { BookOpen, PlusCircle, Trash2, Search, Users, Truck, XCircle, Filter, FileWarning, Calculator, Edit, MoreHorizontal, UserCircle2, Eye, UserX, Landmark } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, where, doc, runTransaction, Timestamp, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import type { DocumentSnapshot, DocumentData, DocumentReference } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
import type { Customer } from './../customers/page';
import type { Seller } from './../sellers/page';
import type { Product } from './../products/page';
import type { Invoice } from './../billing/page'; 
import { format, parseISO } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import type { PaymentRecord, PAYMENT_METHODS as PAYMENT_METHODS_PAYMENT_PAGE, PAYMENT_STATUSES as PAYMENT_STATUSES_PAYMENT_PAGE } from './../payments/page';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';


/**
 * @fileOverview Daily Ledger page for recording sales, purchases, and payment postings.
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
const ENTRY_PURPOSES = ["Ledger Record", "Payment Record"] as const;
const LEDGER_TYPES = ['sale', 'purchase'] as const;


export interface LedgerEntry {
  id: string; 
  date: string; // ISO Date String
  type: typeof LEDGER_TYPES[number];
  entryPurpose: typeof ENTRY_PURPOSES[number]; 
  entityType: 'customer' | 'seller' | 'unknown_customer' | 'unknown_seller';
  entityId: string | null;
  entityName: string;
  items: LedgerItem[];
  subTotal: number;
  gstApplied: boolean;
  taxAmount: number;
  grandTotal: number; 
  paymentAmount?: number; 
  paymentMethod: typeof PAYMENT_METHODS_LEDGER[number] | null;
  paymentStatus: typeof PAYMENT_STATUSES_LEDGER[number];
  notes: string | null; 
  createdByUid: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  updatedByUid?: string | null;
  updatedByName?: string | null;
  originalTransactionAmount?: number; 
  amountPaidNow?: number; 
  remainingAmount?: number; 
  associatedPaymentRecordId?: string | null; 
  relatedInvoiceId?: string | null; 
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
  type: z.enum(LEDGER_TYPES, { required_error: "Transaction type is required." }),
  entryPurpose: z.enum(ENTRY_PURPOSES, { required_error: "Entry purpose is required."}),
  entityType: z.enum(['customer', 'seller', 'unknown_customer', 'unknown_seller'], { required_error: "Entity type is required." }),
  entityId: z.string().nullable().optional().transform(val => (val === undefined || val === "") ? null : val),
  entityName: z.string().min(1, "Entity name is required."),
  items: z.array(ledgerItemSchema).optional(), 
  applyGst: z.boolean().default(false),
  paymentStatus: z.enum(PAYMENT_STATUSES_LEDGER, { required_error: "Payment status is required."}),
  paymentMethod: z.enum(PAYMENT_METHODS_LEDGER).nullable().optional().transform(val => (val === undefined || val === "") ? null : val),
  paymentAmount: z.preprocess( 
    (val) => {
      if (val === undefined || val === null || String(val).trim() === "") {
        return undefined; 
      }
      const num = parseFloat(String(val).replace(/[^0-9.]+/g, ""));
      return isNaN(num) ? undefined : num;
    },
    z.number({ invalid_type_error: "Payment amount must be a valid number." })
      .positive({ message: "Payment amount must be positive." })
      .optional()
  ),
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
  notes: z.string().optional().transform(value => (value === undefined || String(value).trim() === "") ? "N/A" : String(value).trim()),
  relatedInvoiceId: z.string().nullable().optional().transform(val => (val === undefined || String(val).trim() === "") ? null : val),
});

const GST_RATE = 0.18; 

const ledgerEntrySchema = baseLedgerEntrySchema.superRefine((data, ctx) => {
  if (data.entryPurpose === "Ledger Record") {
    if (!data.items || data.items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one item must be added for a ledger record.",
        path: ["items"],
      });
    }
    const subTotal = (data.items || []).reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
    const grandTotal = subTotal * (data.applyGst ? (1 + GST_RATE) : 1);

    if (data.paymentStatus === "partial") {
      if (data.amountPaidNow === undefined || data.amountPaidNow <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount paid now is required for partial payments and must be positive.", path: ["amountPaidNow"] });
      }
      if (data.amountPaidNow && data.amountPaidNow >= grandTotal && grandTotal > 0) { 
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "For partial payment, amount paid must be less than the grand total.", path: ["amountPaidNow"] });
      }
    }
  }

  if (data.entryPurpose === "Payment Record") {
    if (data.paymentAmount === undefined || data.paymentAmount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Payment amount is required and must be positive for payment records.",
        path: ["paymentAmount"],
      });
    }
    if (!data.paymentMethod) { 
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Payment method is required for Payment Record entries.",
            path: ["paymentMethod"],
        });
    }
    if (data.type === 'sale' && data.paymentStatus !== 'paid') { 
    } else if (data.type === 'purchase' && data.paymentStatus !== 'paid') { 
    }
  }

  if ((data.paymentStatus === "paid" || data.paymentStatus === "partial") && data.entryPurpose === "Ledger Record" && !data.paymentMethod) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Payment method is required for Paid or Partial ledger records.",
      path: ["paymentMethod"],
    });
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
  const [activeLedgerTab, setActiveLedgerTab] = useState<'all' | 'customer' | 'seller'>('all');
  
  const [selectedUserFilterName, setSelectedUserFilterName] = useState<string | null>(null);
  const [isEntryDetailsDialogOpen, setIsEntryDetailsDialogOpen] = useState(false);
  const [selectedEntryForDetails, setSelectedEntryForDetails] = useState<LedgerEntry | null>(null);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);


  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'store_manager' | undefined>();

  const form = useForm<LedgerFormValues>({
    resolver: zodResolver(ledgerEntrySchema),
    defaultValues: {
      date: selectedDate, type: 'sale', entryPurpose: ENTRY_PURPOSES[0], entityType: 'customer', entityName: '',
      items: [], applyGst: false,
      paymentStatus: 'paid', paymentMethod: 'Cash',
      paymentAmount: undefined, amountPaidNow: undefined, 
      notes: "", 
      entityId: null, relatedInvoiceId: null,
    },
  });
  const { fields, append, remove, update } = useFieldArray({ control: form.control, name: "items" });

  const newEntityForm = useForm<NewCustomerSellerFormValues>({ resolver: zodResolver(newCustomerSellerSchema), defaultValues: {name: "", phone: ""} });

  const formatCurrency = useCallback((num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, []);
  
  const fetchData = useCallback(async (date: string) => {
    setIsLoading(true);
    try {
      const [custSnap, sellSnap, prodSnap, entrySnap, invoiceSnap] = await Promise.all([
        getDocs(query(collection(db, "customers"), orderBy("name"))),
        getDocs(query(collection(db, "sellers"), orderBy("name"))),
        getDocs(query(collection(db, "products"), orderBy("name"))),
        getDocs(query(collection(db, "ledgerEntries"), where("date", "==", date), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "invoices"), orderBy("createdAt", "desc"))) 
      ]);

      setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
      setSellers(sellSnap.docs.map(d => ({ id: d.id, ...d.data() } as Seller)));
      setProducts(prodSnap.docs.map(d => {
        const data = d.data();
        return { id: d.id, ...data, displayPrice: formatCurrency(data.numericPrice || 0) } as Product;
      }));
       setAllInvoices(invoiceSnap.docs.map(d => ({id: d.id, ...d.data()} as Invoice)));
      setLedgerEntries(entrySnap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id, 
            ...data,
            entryPurpose: data.entryPurpose || ENTRY_PURPOSES[0],
            paymentAmount: data.paymentAmount, 
            createdByUid: data.createdByUid || data.createdBy, 
            createdByName: data.createdByName || "Unknown User",
            updatedByUid: data.updatedByUid || null,
            updatedByName: data.updatedByName || null,
            paymentMethod: data.paymentMethod || null,
            paymentStatus: data.paymentStatus || 'pending',
            notes: data.notes || "N/A",
            entityId: data.entityId || null,
            originalTransactionAmount: data.originalTransactionAmount || data.grandTotal || 0,
            amountPaidNow: typeof data.amountPaidNow === 'number' ? data.amountPaidNow : (data.paymentStatus === 'paid' ? data.grandTotal : 0),
            remainingAmount: typeof data.remainingAmount === 'number' ? data.remainingAmount : (data.grandTotal - (typeof data.amountPaidNow === 'number' ? data.amountPaidNow : (data.paymentStatus === 'paid' ? data.grandTotal : 0))),
            associatedPaymentRecordId: data.associatedPaymentRecordId || null,
            relatedInvoiceId: data.relatedInvoiceId || null,
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
  
  const currentEntityTypeOptions = useMemo(() => {
    const type = form.watch("type");
    if (type === 'sale') { 
        return [
            { value: 'customer', label: 'Existing Customer' },
            { value: 'unknown_customer', label: 'Unknown Customer' }
        ];
    } else { // purchase
        return [
            { value: 'seller', label: 'Existing Seller' },
            { value: 'unknown_seller', label: 'Unknown Seller' }
        ];
    }
  }, [form.watch("type")]); 

  useEffect(() => { 
    const currentType = form.getValues("type");
    const currentEntityType = form.getValues("entityType");
    if (currentType === 'sale' && (currentEntityType === 'seller' || currentEntityType === 'unknown_seller')) {
        form.setValue("entityType", "customer");
    } else if (currentType === 'purchase' && (currentEntityType === 'customer' || currentEntityType === 'unknown_customer')) {
        form.setValue("entityType", "seller");
    }
  }, [form.watch("type"), form]);


  const handleAddProductToLedger = useCallback((product: Product) => {
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
  }, [fields, form, toast, append, update]);

  const handleItemQuantityChange = useCallback((index: number, quantityStr: string) => {
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
  }, [fields, form, products, toast, remove]);

  const handleItemPriceChange = useCallback((index: number, unitPriceStr: string) => {
    if (currentUserRole !== 'admin') {
        toast({ title: "Permission Denied", description: "Only Admins can change item prices directly in the ledger.", variant: "destructive" });
        const item = fields[index]; form.setValue(`items.${index}.unitPrice`, item.unitPrice); return;
    }
    let unitPrice = parseFloat(unitPriceStr);
    if (isNaN(unitPrice) || unitPrice < 0) unitPrice = 0;
    form.setValue(`items.${index}.unitPrice`, unitPrice, { shouldDirty: true });
  }, [currentUserRole, fields, form, toast]);

  const handleEditLedgerEntry = useCallback((entry: LedgerEntry) => {
    if (currentUserRole !== 'admin') {
        toast({title: "Permission Denied", description: "Store managers cannot edit ledger entries directly.", variant: "destructive"});
        return;
    }
    setEditingLedgerEntry(entry);
    setIsLedgerFormOpen(true);
  }, [currentUserRole, toast]);

  const openDeleteConfirmation = useCallback((entry: LedgerEntry) => {
    if (currentUserRole !== 'admin') {
        toast({title: "Permission Denied", description: "Only admins can delete ledger entries.", variant: "destructive"});
        return;
    }
    setLedgerEntryToDelete(entry);
    setIsDeleteConfirmOpen(true);
  }, [currentUserRole, toast]);

  const handleUserFilterClick = useCallback((userName: string) => {
    if (selectedUserFilterName === userName) {
      setSelectedUserFilterName(null); 
    } else {
      setSelectedUserFilterName(userName);
    }
  }, [selectedUserFilterName]);

  const openEntryDetailsDialog = useCallback((entry: LedgerEntry) => {
    setSelectedEntryForDetails(entry);
    setIsEntryDetailsDialogOpen(true);
  }, []);


  useEffect(() => {
    const role = getCookie('userRole');
    if (role === 'admin' || role === 'store_manager') {
      setCurrentUserRole(role as 'admin' | 'store_manager');
    }
  }, []);

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
            entryPurpose: editingLedgerEntry.entryPurpose || ENTRY_PURPOSES[0],
            entityType: editingLedgerEntry.entityType,
            entityId: editingLedgerEntry.entityId,
            entityName: editingLedgerEntry.entityName,
            items: editingLedgerEntry.items.map(item => ({...item})), 
            applyGst: editingLedgerEntry.gstApplied,
            paymentStatus: editingLedgerEntry.paymentStatus,
            paymentMethod: editingLedgerEntry.paymentMethod,
            paymentAmount: editingLedgerEntry.entryPurpose === "Payment Record" ? editingLedgerEntry.grandTotal : undefined,
            amountPaidNow: editingLedgerEntry.entryPurpose === "Ledger Record" && editingLedgerEntry.paymentStatus === 'partial' ? editingLedgerEntry.amountPaidNow : undefined,
            notes: editingLedgerEntry.notes === "N/A" ? "" : editingLedgerEntry.notes || "",
            relatedInvoiceId: editingLedgerEntry.relatedInvoiceId || null,
        });
      } else {
        form.reset({
            date: selectedDate, 
            type: 'sale', 
            entryPurpose: ENTRY_PURPOSES[0],
            entityType: 'customer', 
            entityName: '',
            items: [], 
            applyGst: false,
            paymentStatus: 'paid', 
            paymentMethod: 'Cash',
            paymentAmount: undefined,
            amountPaidNow: undefined,
            notes: "", 
            entityId: null,
            relatedInvoiceId: null,
        });
      }
    }
  }, [editingLedgerEntry, isLedgerFormOpen, form, selectedDate]);


  const transactionTypeWatcher = form.watch("type");
  const entryPurposeWatcher = form.watch("entryPurpose");

  useEffect(() => {
    if (!editingLedgerEntry && form.formState.isDirty && (form.getFieldState("type").isDirty || form.getFieldState("entryPurpose").isDirty)) { 
        const currentEntityType = form.getValues("entityType");
        if (entryPurposeWatcher === "Payment Record") {
            form.setValue("paymentStatus", 'paid'); 
            form.setValue("paymentMethod", form.getValues("paymentMethod") || 'Cash');
            form.setValue("applyGst", false); 
            form.setValue("items", []); 
        } else { // Ledger Record
            if (currentEntityType === "unknown_customer" || currentEntityType === "unknown_seller") {
                form.setValue("paymentStatus", 'paid');
                form.setValue("paymentMethod", form.getValues("paymentMethod") || 'Cash');
            } else if (transactionTypeWatcher === 'sale') { // Known customer sale
                form.setValue("entityType", 'customer');
                form.setValue("paymentStatus", 'paid');
                form.setValue("paymentMethod", 'Cash');
            } else { // Known seller purchase
                form.setValue("entityType", 'seller');
                form.setValue("paymentStatus", 'pending');
                form.setValue("paymentMethod", null);
            }
        }
        
        if (currentEntityType !== "unknown_customer" && currentEntityType !== "unknown_seller" && entryPurposeWatcher === "Ledger Record") {
            form.setValue("entityId", null);
            form.setValue("entityName", "");
        }
        form.setValue("amountPaidNow", undefined);
        form.setValue("paymentAmount", undefined);
        form.clearErrors(["amountPaidNow", "paymentMethod", "paymentAmount", "items"]);
    }
  }, [transactionTypeWatcher, entryPurposeWatcher, form, editingLedgerEntry]);


  const entityTypeWatcher = form.watch("entityType");
  useEffect(() => {
     if (!editingLedgerEntry && form.formState.isDirty && form.getFieldState("entityType").isDirty) {
        const currentTransactionType = form.getValues("type");
        const currentEntryPurpose = form.getValues("entryPurpose");

        if (entityTypeWatcher === "unknown_customer") {
            form.setValue("entityId", null, { shouldDirty: true });
            form.setValue("entityName", "Unknown Customer", { shouldDirty: true });
            if (currentEntryPurpose === "Ledger Record" || currentEntryPurpose === "Payment Record") {
                form.setValue("paymentStatus", "paid", { shouldDirty: true });
                form.setValue("paymentMethod", form.getValues("paymentMethod") || "Cash", { shouldDirty: true });
            }
        } else if (entityTypeWatcher === "unknown_seller") {
            form.setValue("entityId", null, { shouldDirty: true });
            form.setValue("entityName", "Unknown Seller", { shouldDirty: true });
            if (currentEntryPurpose === "Ledger Record" || currentEntryPurpose === "Payment Record") {
                form.setValue("paymentStatus", "paid", { shouldDirty: true });
                form.setValue("paymentMethod", form.getValues("paymentMethod") || "Cash", { shouldDirty: true });
            }
        } else if ((form.getValues("entityName") === "Unknown Customer" || form.getValues("entityName") === "Unknown Seller") &&
                (entityTypeWatcher === "customer" || entityTypeWatcher === "seller")) {
            form.setValue("entityName", "", { shouldDirty: true });
            form.setValue("entityId", null, { shouldDirty: true }); 
            if(currentEntryPurpose === "Ledger Record") {
                if(currentTransactionType === 'sale') {
                    form.setValue("paymentStatus", "paid", { shouldDirty: true });
                    form.setValue("paymentMethod", "Cash", { shouldDirty: true });
                } else { // 'purchase'
                    form.setValue("paymentStatus", "pending", { shouldDirty: true });
                    form.setValue("paymentMethod", null, { shouldDirty: true });
                }
            } else if (currentEntryPurpose === "Payment Record") {
                 form.setValue("paymentStatus", "paid", { shouldDirty: true });
                 form.setValue("paymentMethod", form.getValues("paymentMethod") || "Cash", { shouldDirty: true });
            }
        }
        form.clearErrors(["paymentMethod", "paymentStatus", "paymentAmount"]);
     }
  }, [entityTypeWatcher, form, editingLedgerEntry]);

  const paymentStatusWatcher = form.watch("paymentStatus");
  const shouldShowPaymentMethodForLedgerRecord = (paymentStatusWatcher === "paid" || paymentStatusWatcher === "partial") && entryPurposeWatcher === "Ledger Record";
  const isPartialPaymentForLedgerRecord = paymentStatusWatcher === "partial" && entryPurposeWatcher === "Ledger Record";

  useEffect(() => {
    if (form.formState.isDirty || editingLedgerEntry) {
        if (entryPurposeWatcher === "Ledger Record") {
            if (!shouldShowPaymentMethodForLedgerRecord) {
                form.setValue("paymentMethod", null, { shouldDirty: true });
            } else if (shouldShowPaymentMethodForLedgerRecord && !form.getValues("paymentMethod")) {
                form.setValue("paymentMethod", 'Cash', { shouldDirty: true });
            }
            
            if (paymentStatusWatcher !== 'partial') {
                form.setValue("amountPaidNow", undefined, { shouldDirty: true });
                form.clearErrors("amountPaidNow"); 
            } else {
               if(form.getValues("amountPaidNow") === undefined && form.getFieldState("amountPaidNow").isDirty) {
                  form.trigger("amountPaidNow"); 
               }
            }
        } else if (entryPurposeWatcher === "Payment Record") {
            if (!form.getValues("paymentMethod")) {
                 form.setValue("paymentMethod", 'Cash', { shouldDirty: true });
            }
            form.setValue("amountPaidNow", undefined, { shouldDirty: true }); 
            form.clearErrors("amountPaidNow");
        }
        form.clearErrors("paymentMethod"); 
    }
  }, [shouldShowPaymentMethodForLedgerRecord, paymentStatusWatcher, entryPurposeWatcher, form, editingLedgerEntry]);


  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
        if (name?.startsWith("items")) {
            form.getValues("items")?.forEach((item, index) => {
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
  const paymentAmountWatcher = form.watch("paymentAmount"); 

  const currentSubtotal = entryPurposeWatcher === "Ledger Record" ? (itemsWatcher || []).reduce((acc, item) => acc + ((item.quantity || 0) * (item.unitPrice || 0)), 0) : 0;
  const currentTax = entryPurposeWatcher === "Ledger Record" && applyGstWatcher ? currentSubtotal * GST_RATE : 0;
  const currentGrandTotal = entryPurposeWatcher === "Ledger Record" ? currentSubtotal + currentTax : (paymentAmountWatcher || 0);
  
  let currentAmountPaidNowForDisplay: number;
  if (entryPurposeWatcher === "Ledger Record") {
    if (paymentStatusWatcher === 'paid') {
      currentAmountPaidNowForDisplay = currentGrandTotal;
    } else if (paymentStatusWatcher === 'partial') {
      currentAmountPaidNowForDisplay = amountPaidNowWatcher || 0;
    } else { 
      currentAmountPaidNowForDisplay = 0;
    }
  } else { // Payment Record
    currentAmountPaidNowForDisplay = paymentAmountWatcher || 0;
  }
  const currentRemainingAmountForDisplay = currentGrandTotal - currentAmountPaidNowForDisplay;


  const onLedgerSubmit = async (data: LedgerFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser) { toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" }); return; }

    const currentUserName = currentUser.displayName || currentUser.email || "System User";

    try {
      await runTransaction(db, async (transaction) => {
        
        // --- Phase 1: Reads ---
        const ledgerDocRef = editingLedgerEntry ? doc(db, "ledgerEntries", editingLedgerEntry.id) : doc(collection(db, "ledgerEntries"));
        const oldPaymentDocRef = editingLedgerEntry?.associatedPaymentRecordId ? doc(db, "payments", editingLedgerEntry.associatedPaymentRecordId) : null;
        
        let originalLedgerEntryData: LedgerEntry | null = null;
        if (editingLedgerEntry) {
          const originalLedgerSnap = await transaction.get(ledgerDocRef);
          if (!originalLedgerSnap.exists()) throw new Error("Original ledger entry not found for editing.");
          originalLedgerEntryData = originalLedgerSnap.data() as LedgerEntry;
        }
        if (oldPaymentDocRef) {
          await transaction.get(oldPaymentDocRef); // Read to ensure it exists if we need to delete it.
        }
        
        const productIdsInvolved = new Set<string>();
        if (data.entryPurpose === "Ledger Record") { (data.items || []).forEach(item => productIdsInvolved.add(item.productId)); }
        if (originalLedgerEntryData?.entryPurpose === "Ledger Record") { originalLedgerEntryData.items.forEach(item => productIdsInvolved.add(item.productId)); }
        
        const productSnapshots = new Map<string, DocumentSnapshot<DocumentData>>();
        for (const productId of productIdsInvolved) {
            const productRefFromDb = doc(db, "products", productId);
            const productSnap = await transaction.get(productRefFromDb);
            if (!productSnap.exists()) throw new Error(`Product ID ${productId} not found.`);
            productSnapshots.set(productId, productSnap);
        }

        let targetInvoiceSnap: DocumentSnapshot<DocumentData> | null = null;
        const originalConsolidatedLedgerEntrySnaps = new Map<string, DocumentSnapshot<DocumentData>>();
        if (data.entryPurpose === "Payment Record" && data.relatedInvoiceId) {
            targetInvoiceSnap = await transaction.get(doc(db, "invoices", data.relatedInvoiceId));
            if (targetInvoiceSnap.exists() && targetInvoiceSnap.data()?.consolidatedLedgerEntryIds?.length > 0) {
                for (const entryId of targetInvoiceSnap.data()!.consolidatedLedgerEntryIds) {
                    const snap = await transaction.get(doc(db, "ledgerEntries", entryId));
                    if (snap.exists()) originalConsolidatedLedgerEntrySnaps.set(entryId, snap);
                }
            }
        }
        
        // --- Phase 2: Logic & Calculations ---
        let subTotalForSave: number, taxAmountForSave: number, grandTotalForSave: number;
        let itemsForSave: LedgerItem[], amountPaidForLedgerSave: number, remainingAmountForLedgerSave: number;
        
        if (data.entryPurpose === "Ledger Record") {
            itemsForSave = (data.items || []).map(item => ({ ...item, totalPrice: (item.quantity || 0) * (item.unitPrice || 0) }));
            subTotalForSave = itemsForSave.reduce((sum, item) => sum + item.totalPrice, 0);
            taxAmountForSave = data.applyGst ? subTotalForSave * GST_RATE : 0;
            grandTotalForSave = subTotalForSave + taxAmountForSave;
            amountPaidForLedgerSave = data.paymentStatus === 'paid' ? grandTotalForSave : (data.paymentStatus === 'partial' ? data.amountPaidNow || 0 : 0);
            remainingAmountForLedgerSave = grandTotalForSave - amountPaidForLedgerSave;
        } else {
            itemsForSave = []; subTotalForSave = 0; taxAmountForSave = 0;
            grandTotalForSave = data.paymentAmount || 0;
            amountPaidForLedgerSave = grandTotalForSave; remainingAmountForLedgerSave = 0;
        }

        const productStockUpdates: Array<{ ref: DocumentReference; newStock: number }> = [];
        if (data.entryPurpose === "Ledger Record") {
            for (const productId of productIdsInvolved) {
                const productSnap = productSnapshots.get(productId)!;
                const currentDbStock = productSnap.data()!.stock as number;
                let calculatedNewStock = currentDbStock;
                
                if (originalLedgerEntryData?.entryPurpose === "Ledger Record") {
                    const originalItem = originalLedgerEntryData.items.find(i => i.productId === productId);
                    if (originalItem) calculatedNewStock += originalLedgerEntryData.type === 'sale' ? originalItem.quantity : -originalItem.quantity;
                }
                const newItem = itemsForSave.find(i => i.productId === productId);
                if (newItem) calculatedNewStock += data.type === 'sale' ? -newItem.quantity : newItem.quantity;

                if (calculatedNewStock < 0) throw new Error(`Insufficient stock for ${productSnap.data()!.name}.`);
                if (calculatedNewStock !== currentDbStock) productStockUpdates.push({ ref: productSnap.ref, newStock: calculatedNewStock });
            }
        }

        const reconciledOriginalLedgerUpdates: Array<{ref: DocumentReference, data: Partial<LedgerEntry>}> = [];
        let reconciledTargetInvoiceUpdate: {ref: DocumentReference, data: Partial<Invoice>} | null = null;
        if (targetInvoiceSnap?.exists() && originalConsolidatedLedgerEntrySnaps.size > 0) {
            const targetInvoiceData = targetInvoiceSnap.data() as Invoice;
            let paymentToDistribute = grandTotalForSave;
            
            const originalLedgerEntriesDataToSort: LedgerEntry[] = Array.from(originalConsolidatedLedgerEntrySnaps.values()).map(snap => ({ id: snap.id, ...snap.data() } as LedgerEntry));
            originalLedgerEntriesDataToSort.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            for (const originalEntry of originalLedgerEntriesDataToSort) {
                if (paymentToDistribute <= 0 || (originalEntry.remainingAmount || 0) <= 0.01) continue;
                const amountToApply = Math.min(paymentToDistribute, originalEntry.remainingAmount || 0);
                const updatedOriginalEntryData: Partial<LedgerEntry> = {
                    amountPaidNow: (originalEntry.amountPaidNow || 0) + amountToApply,
                    remainingAmount: (originalEntry.remainingAmount || 0) - amountToApply,
                    updatedAt: serverTimestamp(),
                };
                updatedOriginalEntryData.paymentStatus = (updatedOriginalEntryData.remainingAmount ?? 0) <= 0.01 ? 'paid' : 'partial';
                reconciledOriginalLedgerUpdates.push({ref: doc(db, "ledgerEntries", originalEntry.id), data: updatedOriginalEntryData});
                paymentToDistribute -= amountToApply;
            }
            const newTotalAmountForConsolidated = Math.max(0, targetInvoiceData.totalAmount - grandTotalForSave);
            reconciledTargetInvoiceUpdate = {
                ref: targetInvoiceSnap.ref, 
                data: { totalAmount: newTotalAmountForConsolidated, status: newTotalAmountForConsolidated <= 0.01 ? 'Paid' : 'Partially Paid', updatedAt: serverTimestamp() }
            };
        }

        const finalLedgerDataToCommit: Partial<LedgerEntry> & { updatedAt: any } = { 
          date: data.date, type: data.type, entryPurpose: data.entryPurpose, entityType: data.entityType, entityId: data.entityId, entityName: data.entityName, 
          items: itemsForSave, subTotal: subTotalForSave, gstApplied: data.entryPurpose === "Ledger Record" ? data.applyGst : false, taxAmount: taxAmountForSave, grandTotal: grandTotalForSave,
          paymentMethod: (data.entryPurpose === "Payment Record" || (data.entryPurpose === "Ledger Record" && (data.paymentStatus === 'paid' || data.paymentStatus === 'partial'))) ? data.paymentMethod : null,
          paymentStatus: data.paymentStatus, originalTransactionAmount: grandTotalForSave, amountPaidNow: amountPaidForLedgerSave, remainingAmount: remainingAmountForLedgerSave,
          notes: data.notes, relatedInvoiceId: data.relatedInvoiceId || null, updatedAt: serverTimestamp(),
        };

        if (editingLedgerEntry && originalLedgerEntryData) {
            Object.assign(finalLedgerDataToCommit, { updatedByUid: currentUser.uid, updatedByName: currentUserName });
        } else {
            Object.assign(finalLedgerDataToCommit, { createdByUid: currentUser.uid, createdByName: currentUserName, createdAt: serverTimestamp() });
        }
        
        let newAssociatedPaymentRecordId: string | null = null;
        if (data.entryPurpose === "Payment Record" || (data.entryPurpose === "Ledger Record" && (data.paymentStatus === 'paid' || data.paymentStatus === 'partial'))) {
          const paymentDocRef = doc(collection(db, "payments"));
          newAssociatedPaymentRecordId = paymentDocRef.id;
          finalLedgerDataToCommit.associatedPaymentRecordId = newAssociatedPaymentRecordId;

          const paymentDataForSave: Omit<PaymentRecord, 'id' | 'displayAmountPaid'> & { ledgerEntryId: string } = {
            type: data.type === 'sale' ? 'customer' : 'supplier', 
            relatedEntityName: data.entityName, relatedEntityId: data.entityId || `unknown-${data.entityType}-${Date.now()}`,
            relatedInvoiceId: data.relatedInvoiceId || null, date: format(parseISO(data.date), "MMM dd, yyyy"), isoDate: data.date, 
            amountPaid: amountPaidForLedgerSave, originalInvoiceAmount: grandTotalForSave, remainingBalanceOnInvoice: remainingAmountForLedgerSave, 
            method: finalLedgerDataToCommit.paymentMethod || null,
            transactionId: null, 
            status: data.paymentStatus === 'paid' ? (data.type === 'sale' ? 'Received' : 'Sent') : 'Partial',
            notes: `Payment from Ledger Entry. ${data.notes || ''}`.trim(), ledgerEntryId: ledgerDocRef.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          };
          transaction.set(paymentDocRef, paymentDataForSave);
        } else {
           finalLedgerDataToCommit.associatedPaymentRecordId = null;
        }

        // --- Phase 3: Writes ---
        if (oldPaymentDocRef) {
            transaction.delete(oldPaymentDocRef);
        }

        productStockUpdates.forEach(pu => transaction.update(pu.ref, { stock: pu.newStock, updatedAt: serverTimestamp() }));
        if (editingLedgerEntry) transaction.set(ledgerDocRef, finalLedgerDataToCommit, { merge: true }); else transaction.set(ledgerDocRef, finalLedgerDataToCommit);
        reconciledOriginalLedgerUpdates.forEach(updateOp => transaction.update(updateOp.ref, updateOp.data));
        if (reconciledTargetInvoiceUpdate) transaction.update(reconciledTargetInvoiceUpdate.ref, reconciledTargetInvoiceUpdate.data);
      });
      toast({ title: editingLedgerEntry ? "Ledger Entry Updated" : "Ledger Entry Saved", description: "Transaction and related records have been successfully saved." });
      form.reset({ date: selectedDate, type: 'sale', entryPurpose:ENTRY_PURPOSES[0], entityType: 'customer', entityName: '', items: [], applyGst: false, paymentStatus: 'paid', paymentMethod: 'Cash', paymentAmount: undefined, amountPaidNow: undefined, notes: "", entityId: null, relatedInvoiceId: null });
      setIsLedgerFormOpen(false); setEditingLedgerEntry(null); fetchData(selectedDate); setProductSearchTerm('');
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
          ...(newEntityType === 'customer' && { totalSpent: "₹0.00", createdByUid: currentUser.uid })
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

            if (entryData.entryPurpose === "Ledger Record") {
                const productIdsInvolved = new Set<string>();
                entryData.items.forEach(item => productIdsInvolved.add(item.productId));
                const productSnapshots = new Map<string, DocumentSnapshot<DocumentData>>();
                for (const productId of productIdsInvolved) {
                    const productRefFromDb = doc(db, "products", productId); 
                    const productSnap = await transaction.get(productRefFromDb);
                    if (!productSnap.exists()) throw new Error(`Product from entry not found (ID: ${productId}).`);
                    productSnapshots.set(productId, productSnap);
                }
                for (const item of entryData.items) {
                    const productSnap = productSnapshots.get(item.productId)!;
                    if (!productSnap.ref || !productSnap.ref.firestore) throw new Error(`Invalid product reference for ${item.productName}`);
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
            }

            if (entryData.associatedPaymentRecordId) {
                const paymentRef = doc(db, "payments", entryData.associatedPaymentRecordId);
                const paymentSnap = await transaction.get(paymentRef);
                if (paymentSnap.exists()) {
                    transaction.delete(paymentRef);
                } else {
                   console.warn(`Tried to delete non-existent associated payment record ID: ${entryData.associatedPaymentRecordId}`);
                }
            }
            transaction.delete(ledgerDocRef);
        });
        toast({ title: "Ledger Entry Deleted", description: `Entry for "${ledgerEntryToDelete.entityName}" deleted and records reverted.` });
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

  const displayedLedgerEntries = useMemo(() => {
    return ledgerEntries
    .filter(entry => {
        if (activeLedgerTab === 'customer') return entry.type === 'sale'; 
        if (activeLedgerTab === 'seller') return entry.type === 'purchase'; 
        return true; 
    })
    .filter(entry => {
        if (selectedUserFilterName) {
            return (entry.createdByName === selectedUserFilterName || entry.updatedByName === selectedUserFilterName);
        }
        return true;
    })
    .filter(entry => {
        if (!ledgerSearchTerm) return true;
        const searchTermLower = ledgerSearchTerm.toLowerCase();
        const matchesEntity = entry.entityName.toLowerCase().includes(searchTermLower);
        const matchesItems = entry.entryPurpose === "Ledger Record" && entry.items.some(item =>
            item.productName.toLowerCase().includes(searchTermLower) ||
            item.quantity.toString().includes(searchTermLower) ||
            formatCurrency(item.unitPrice).toLowerCase().includes(searchTermLower) ||
            formatCurrency(item.totalPrice).toLowerCase().includes(searchTermLower)
        );
        const matchesNotes = entry.notes ? entry.notes.toLowerCase().includes(searchTermLower) : false;
        const matchesPaymentMethod = entry.paymentMethod ? entry.paymentMethod.toLowerCase().includes(searchTermLower) : false;
        
        const matchesCreator = entry.createdByName?.toLowerCase().includes(searchTermLower);
        const matchesUpdater = entry.updatedByName?.toLowerCase().includes(searchTermLower);
        const matchesPurpose = entry.entryPurpose.toLowerCase().includes(searchTermLower);
        const matchesPaymentAmount = entry.entryPurpose === "Payment Record" && entry.grandTotal.toString().includes(searchTermLower);

        return matchesEntity || matchesItems || matchesNotes || matchesPaymentMethod || matchesCreator || matchesUpdater || matchesPurpose || matchesPaymentAmount;
    });
  }, [ledgerEntries, activeLedgerTab, ledgerSearchTerm, selectedUserFilterName, formatCurrency]);
  


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
            }} className="mt-4 sm:mt-0">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Ledger Entry
            </Button>
        }
      />

      <Dialog open={isLedgerFormOpen} onOpenChange={(isOpen) => {
          if (!isOpen) { 
            setProductSearchTerm(''); 
            setEditingLedgerEntry(null); 
            form.reset({ date: selectedDate, type: 'sale', entryPurpose: ENTRY_PURPOSES[0], entityType: 'customer', entityName: '', items: [], applyGst: false, paymentStatus: 'paid', paymentMethod: 'Cash', paymentAmount: undefined, amountPaidNow: undefined, notes: "", entityId: null, relatedInvoiceId: null });
          }
          setIsLedgerFormOpen(isOpen);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingLedgerEntry ? "Edit Ledger Entry" : "New Ledger Entry"}</DialogTitle>
            <DialogDescription>Fill in the details for the transaction. {editingLedgerEntry ? "Admins can modify existing entries." : ""}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onLedgerSubmit)} className="max-h-[75vh] overflow-y-auto pr-4">
              <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="date" render={({ field }) => (
                      <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="entryPurpose" render={({ field }) => (
                      <FormItem><FormLabel>Entry Purpose</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!!editingLedgerEntry}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>{ENTRY_PURPOSES.map(ep => <SelectItem key={ep} value={ep}>{ep}</SelectItem>)}</SelectContent>
                          </Select><FormMessage />
                      </FormItem>)} />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem><FormLabel>Transaction Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!!editingLedgerEntry}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                  <SelectItem value="sale">{entryPurposeWatcher === "Payment Record" ? "Payment Received" : "Sale / Stock Out"}</SelectItem>
                                  <SelectItem value="purchase">{entryPurposeWatcher === "Payment Record" ? "Payment Sent" : "Purchase / Stock In"}</SelectItem>
                              </SelectContent>
                          </Select><FormMessage />
                      </FormItem>)} />
                    <FormField control={form.control} name="entityType" render={({ field }) => (
                      <FormItem><FormLabel>{form.getValues("type") === 'sale' ? 'Customer Type' : 'Seller Type'}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={!!editingLedgerEntry}>
                              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                              <SelectContent>
                                  {currentEntityTypeOptions.map(option => (
                                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                  ))}
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
                                  value={field.value ?? ""}
                                  disabled={!!editingLedgerEntry && form.getValues("entityType") !== 'unknown_customer' && form.getValues("entityType") !== 'unknown_seller'}
                              >
                                  <FormControl><SelectTrigger><SelectValue placeholder={`Select existing ${form.getValues("type") === 'sale' ? 'customer' : 'seller'}`} /></SelectTrigger></FormControl>
                                  <SelectContent>
                                      {(form.getValues("type") === 'sale' ? customers : sellers).map(e => <SelectItem key={e.id} value={e.id}>{e.name} {e.phone ? `(${e.phone})` : ''}</SelectItem>)}
                                  </SelectContent>
                              </Select><FormMessage />
                          </FormItem>)} />
                       <Button type="button" variant="outline" onClick={() => { setNewEntityType(form.getValues("type") === 'sale' ? 'customer' : 'seller'); setIsNewEntityDialogOpen(true); }} disabled={!!editingLedgerEntry} className="w-full sm:w-auto">
                          <PlusCircle className="mr-2 h-4 w-4" /> Add New {form.getValues("type") === 'sale' ? 'Customer' : 'Seller'}
                      </Button>
                  </div>
                )}
                 <FormField control={form.control} name="entityName" render={({ field }) => (<FormItem className={((form.getValues("entityType") === "unknown_customer" || form.getValues("entityType") === "unknown_seller") || (!!editingLedgerEntry && (editingLedgerEntry.entityType === 'unknown_customer' || editingLedgerEntry.entityType === 'unknown_seller')) ) ? "" : "hidden"}><FormLabel>Entity Name</FormLabel><FormControl><Input {...field} readOnly /></FormControl><FormMessage /></FormItem>)} />

                {entryPurposeWatcher === "Ledger Record" && (
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
                            <div><p>{p.name} <span className="text-xs text-muted-foreground">({products.find(prod => prod.id === p.id)?.sku || 'N/A'})</span></p><p className="text-xs text-muted-foreground">Price: {p.displayPrice} - Stock: {p.stock} {p.unitOfMeasure}</p></div>
                            <Button variant="ghost" size="sm" disabled={p.stock <= 0 && form.getValues("type") === 'sale'}>{p.stock > 0 || form.getValues("type") === 'purchase' ? "Add" : "Out of stock"}</Button>
                            </div>
                        ))}
                        </div>
                    )}
                    {productSearchTerm && filteredProducts.length === 0 && (<p className="mt-2 text-sm text-center text-muted-foreground">No products found matching "{productSearchTerm}".</p>)}

                    {fields.map((item, index) => (
                        <Card key={item.id} className="p-3 space-y-2 bg-muted/20 dark:bg-muted/10">
                        <div className="flex justify-between items-center">
                            <p className="font-medium">{item.productName} <span className="text-xs text-muted-foreground">({products.find(p=>p.id === item.productId)?.sku}) - Unit: {item.unitOfMeasure}</span></p>
                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} title="Remove item"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <FormField control={form.control} name={`items.${index}.quantity`} render={({ field: f }) => (<FormItem><FormLabel className="text-xs">Qty</FormLabel><FormControl><Input type="number" {...f} onChange={e => { f.onChange(parseFloat(e.target.value) || 0); handleItemQuantityChange(index, e.target.value); }} placeholder="Qty" aria-label="Quantity"/></FormControl><FormMessage/></FormItem>)} />
                            <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field: f }) => (<FormItem><FormLabel className="text-xs">Price (₹)</FormLabel><FormControl><Input type="number" {...f} onChange={e => { f.onChange(parseFloat(e.target.value) || 0); handleItemPriceChange(index, e.target.value); }} placeholder="Price/Unit" aria-label="Unit Price" disabled={currentUserRole !== 'admin'}/></FormControl><FormMessage/></FormItem>)} />
                            <FormItem><FormLabel className="text-xs">Total (₹)</FormLabel><Input value={formatCurrency((form.getValues(`items.${index}.quantity`) || 0) * (form.getValues(`items.${index}.unitPrice`) || 0))} readOnly placeholder="Total" aria-label="Total Price"/></FormItem>
                        </div>
                        {currentUserRole !== 'admin' && form.getValues(`items.${index}.unitPrice`) !== products.find(p => p.id === item.productId)?.numericPrice && (<p className="text-xs text-amber-600 dark:text-amber-400">Price is based on product database. Only Admins can override price here.</p>)}
                        </Card>
                    ))}
                    {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No items added to this transaction yet.</p>}
                    </div>
                )}
                
                {entryPurposeWatcher === "Payment Record" && (
                  <>
                     <FormField control={form.control} name="paymentAmount" render={({ field }) => (
                        <FormItem><FormLabel>Payment Amount (₹)</FormLabel>
                            <FormControl><Input type="number" step="0.01" placeholder="e.g., 1000.00" {...field} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} value={field.value ?? ""} /></FormControl>
                            <FormMessage />
                        </FormItem>)} />
                     <FormField control={form.control} name="relatedInvoiceId" render={({ field }) => (
                          <FormItem>
                            <FormLabel>For Invoice # (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select if payment is for a specific invoice" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {allInvoices.filter(inv => inv.status !== 'Paid' && inv.status !== 'Cancelled' && (form.getValues("entityId") ? inv.customerId === form.getValues("entityId") : true))
                                      .map(inv => (
                                        <SelectItem key={inv.id} value={inv.id}>
                                            {inv.invoiceNumber} - {inv.customerName} ({formatCurrency(inv.totalAmount)}) - Status: {inv.status}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormDescription>Link this payment to an existing invoice, especially useful for consolidated invoices.</FormDescription>
                            <FormMessage />
                          </FormItem>
                      )} />
                  </>
                )}

                {entryPurposeWatcher === "Ledger Record" && (
                    <FormField control={form.control} name="applyGst" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5"><FormLabel>Apply GST ({GST_RATE*100}%)</FormLabel><FormDescription>Calculate and add GST to this transaction.</FormDescription></div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                    )} />
                )}

                <div className="pt-4 border-t space-y-3">
                   {entryPurposeWatcher === "Ledger Record" && <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span className="font-medium">{formatCurrency(currentSubtotal)}</span></div>}
                   {entryPurposeWatcher === "Ledger Record" && applyGstWatcher && <div className="flex justify-between"><span className="text-muted-foreground">Tax (GST {GST_RATE*100}%):</span><span className="font-medium">{formatCurrency(currentTax)}</span></div>}
                   <div className="flex justify-between text-lg font-bold"><span >Grand Total:</span><span>{formatCurrency(currentGrandTotal)}</span></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="paymentStatus" render={({ field }) => (
                      <FormItem><FormLabel>Payment Status</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value} 
                            disabled={(form.getValues("entityType") === 'unknown_customer' || form.getValues("entityType") === 'unknown_seller') || entryPurposeWatcher === "Payment Record" }
                          >
                              <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                              <SelectContent>
                                  {PAYMENT_STATUSES_LEDGER.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                              </SelectContent>
                          </Select><FormMessage />
                      </FormItem>)} />
                  {(shouldShowPaymentMethodForLedgerRecord || entryPurposeWatcher === "Payment Record") && (
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
                {isPartialPaymentForLedgerRecord && (
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
                <Button type="submit" disabled={isLoading || (entryPurposeWatcher === "Ledger Record" && fields.length === 0) || form.formState.isSubmitting}>
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
                    &quot;{ledgerEntryToDelete?.entityName}&quot; and revert associated stock changes (if applicable). If a payment record was auto-created, it will also be deleted.
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

      <Dialog open={isEntryDetailsDialogOpen} onOpenChange={setIsEntryDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Ledger Entry Details</DialogTitle>
                <DialogDescription>
                    Detailed view for the selected ledger entry.
                </DialogDescription>
            </DialogHeader>
            {selectedEntryForDetails && (
                <ScrollArea className="max-h-[70vh] pr-5">
                    <div className="space-y-4 text-sm py-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                            <div><strong className="text-muted-foreground">Date:</strong> {selectedEntryForDetails.date ? format(parseISO(selectedEntryForDetails.date), "MMM dd, yyyy") : 'N/A'}</div>
                            <div><strong className="text-muted-foreground">Entry Purpose:</strong> {selectedEntryForDetails.entryPurpose}</div>
                            <div><strong className="text-muted-foreground">Transaction Type:</strong> <Badge variant={selectedEntryForDetails.type === 'sale' ? 'default' : 'secondary'} className={selectedEntryForDetails.type === 'sale' ? 'bg-green-100 text-green-700 dark:bg-green-700/80 dark:text-green-100' : 'bg-blue-100 text-blue-700 dark:bg-blue-700/80 dark:text-blue-100'}>{selectedEntryForDetails.type.charAt(0).toUpperCase() + selectedEntryForDetails.type.slice(1)}</Badge></div>
                            <div><strong className="text-muted-foreground">Entity Name:</strong> {selectedEntryForDetails.entityName}</div>
                            <div><strong className="text-muted-foreground">Entity Type:</strong> {selectedEntryForDetails.entityType.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</div>
                        </div>
                        
                        {selectedEntryForDetails.entryPurpose === "Ledger Record" && selectedEntryForDetails.items.length > 0 && (
                            <>
                            <Separator />
                            <div>
                                <h4 className="font-semibold mb-1">Items:</h4>
                                <Table className="text-xs">
                                    <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {selectedEntryForDetails.items.map((item, idx) => (
                                            <TableRow key={idx}><TableCell>{item.productName} ({item.unitOfMeasure})</TableCell><TableCell className="text-right">{item.quantity}</TableCell><TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell><TableCell className="text-right">{formatCurrency(item.totalPrice)}</TableCell></TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            </>
                        )}
                        <Separator />
                        <div>
                            <h4 className="font-semibold mb-1">Financials:</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                {selectedEntryForDetails.entryPurpose === "Ledger Record" && <div><strong className="text-muted-foreground">Subtotal:</strong> {formatCurrency(selectedEntryForDetails.subTotal)}</div> }
                                {selectedEntryForDetails.entryPurpose === "Ledger Record" && <div><strong className="text-muted-foreground">GST Applied:</strong> {selectedEntryForDetails.gstApplied ? `Yes (${GST_RATE*100}%)` : 'No'}</div> }
                                {selectedEntryForDetails.entryPurpose === "Ledger Record" && selectedEntryForDetails.gstApplied && <div><strong className="text-muted-foreground">Tax Amount:</strong> {formatCurrency(selectedEntryForDetails.taxAmount)}</div>}
                                <div className="font-bold"><strong className="text-muted-foreground">Grand Total:</strong> {formatCurrency(selectedEntryForDetails.grandTotal)}</div>
                                {selectedEntryForDetails.entryPurpose === "Ledger Record" && <div><strong className="text-muted-foreground">Original Trans. Amount:</strong> {formatCurrency(selectedEntryForDetails.originalTransactionAmount || selectedEntryForDetails.grandTotal)}</div>}
                                <div><strong className="text-muted-foreground">Amount Paid:</strong> {formatCurrency(selectedEntryForDetails.amountPaidNow || 0)}</div>
                                {selectedEntryForDetails.entryPurpose === "Ledger Record" && <div><strong className="text-muted-foreground">Remaining Due:</strong> {formatCurrency(selectedEntryForDetails.remainingAmount || 0)}</div>}
                            </div>
                        </div>
                        <Separator />
                        <div>
                             <h4 className="font-semibold mb-1">Payment Details:</h4>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                <div><strong className="text-muted-foreground">Status:</strong> {selectedEntryForDetails.paymentStatus.charAt(0).toUpperCase() + selectedEntryForDetails.paymentStatus.slice(1)}</div>
                                <div><strong className="text-muted-foreground">Method:</strong> {selectedEntryForDetails.paymentMethod || "N/A"}</div>
                             </div>
                        </div>
                        {selectedEntryForDetails.notes && selectedEntryForDetails.notes !== "N/A" && (
                            <> <Separator /> <div><strong className="text-muted-foreground">Notes:</strong> {selectedEntryForDetails.notes}</div></>
                        )}
                         {selectedEntryForDetails.relatedInvoiceId && (
                            <> <Separator /> <div><strong className="text-muted-foreground">Linked Invoice:</strong> {allInvoices.find(inv => inv.id === selectedEntryForDetails.relatedInvoiceId)?.invoiceNumber || `Ref: ${selectedEntryForDetails.relatedInvoiceId}`}</div></>
                        )}
                        <Separator />
                         <div>
                             <h4 className="font-semibold mb-1">Audit Information:</h4>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                <div><strong className="text-muted-foreground">Created By:</strong> {selectedEntryForDetails.createdByName}</div>
                                <div><strong className="text-muted-foreground">Created At:</strong> {selectedEntryForDetails.createdAt ? format(selectedEntryForDetails.createdAt.toDate(), "MMM dd, yyyy HH:mm") : 'N/A'}</div>
                                {selectedEntryForDetails.updatedByName && <div><strong className="text-muted-foreground">Modified By:</strong> {selectedEntryForDetails.updatedByName}</div>}
                                {selectedEntryForDetails.updatedAt && <div><strong className="text-muted-foreground">Modified At:</strong> {format(selectedEntryForDetails.updatedAt.toDate(), "MMM dd, yyyy HH:mm")}</div>}
                             </div>
                        </div>
                        {selectedEntryForDetails.associatedPaymentRecordId && (
                             <> <Separator /> <div><strong className="text-muted-foreground">Linked Payment Ref:</strong> {selectedEntryForDetails.associatedPaymentRecordId.substring(0, 10)}...</div></>
                        )}
                    </div>
                </ScrollArea>
            )}
            <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>


      <Card className="mt-6 shadow-lg rounded-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="font-headline text-foreground">Ledger Entries for {format(parseISO(selectedDate), "MMMM dd, yyyy")}</CardTitle>
              <CardDescription>Browse recorded transactions for the selected date. {currentUserRole === 'admin' && "Admins can edit/delete."}</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                 <Input type="date" value={selectedDate} onChange={e => {setSelectedDate(e.target.value); setSelectedUserFilterName(null);}} className="w-full sm:w-auto h-10"/>
                 <div className="relative w-full sm:w-64">
                     <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                     <Input placeholder="Search by entity, product, user..." className="pl-8 h-10" value={ledgerSearchTerm} onChange={e => setLedgerSearchTerm(e.target.value)} />
                 </div>
            </div>
          </div>
          {selectedUserFilterName && (
            <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => handleUserFilterClick(selectedUserFilterName)}>
                    <UserX className="mr-2 h-4 w-4" />
                    Clear filter for: {selectedUserFilterName}
                </Button>
            </div>
           )}
        </CardHeader>
        <CardContent>
          <Tabs value={activeLedgerTab} onValueChange={(value) => setActiveLedgerTab(value as any)} className="w-full mb-4">
            <TabsList className="flex flex-col items-stretch h-auto sm:h-10 sm:flex-row sm:items-center sm:justify-start gap-1">
                <TabsTrigger value="all" className="w-full sm:w-auto">All Entries</TabsTrigger>
                <TabsTrigger value="customer" className="w-full sm:w-auto">Customer</TabsTrigger>
                <TabsTrigger value="seller" className="w-full sm:w-auto">Seller</TabsTrigger>
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
                        : selectedUserFilterName ? `No entries for user "${selectedUserFilterName}" on this date or for this tab.`
                        : `There are no ledger entries recorded for ${format(parseISO(selectedDate), "MMMM dd, yyyy")}.`
                    }
                </p>
                 <Button onClick={() => { setEditingLedgerEntry(null); setIsLedgerFormOpen(true); }} className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add First Entry for this Date
                </Button>
            </div>
          ) : (
            <>
            {/* Desktop View: Table */}
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="min-w-[180px]">Type</TableHead>
                  <TableHead className="min-w-[150px]">Entity</TableHead>
                  <TableHead className="min-w-[200px]">Details</TableHead>
                  <TableHead className="text-right min-w-[100px]">Total (₹)</TableHead>
                  <TableHead className="min-w-[150px]">Payment</TableHead>
                  <TableHead className="min-w-[120px]">Created By</TableHead>
                  <TableHead className="text-right w-28">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {displayedLedgerEntries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge 
                            variant={entry.type === 'sale' ? 'default' : 'secondary'} 
                            className={`${
                                entry.entryPurpose === "Payment Record" ? (entry.type === 'sale' ? "bg-teal-100 text-teal-700 dark:bg-teal-700/80 dark:text-teal-100" : "bg-purple-100 text-purple-700 dark:bg-purple-700/80 dark:text-purple-100") :
                                (entry.type === 'sale' ? 'bg-green-100 text-green-700 dark:bg-green-700/80 dark:text-green-100' : 'bg-blue-100 text-blue-700 dark:bg-blue-700/80 dark:text-blue-100')
                            } whitespace-nowrap`}
                        >
                            {entry.entryPurpose === "Payment Record" ? 
                                (entry.type === 'sale' ? 'Payment Received' : 'Payment Sent') :
                                entry.type.charAt(0).toUpperCase() + entry.type.slice(1)
                            }
                        </Badge>
                      </TableCell>
                      <TableCell>{entry.entityName}</TableCell>
                      <TableCell className="text-xs">
                        {entry.entryPurpose === "Ledger Record" ? 
                            (entry.items.map(i => `${i.productName} (x${i.quantity})`).join(', ').substring(0, 50) + (entry.items.map(i => `${i.productName} (x${i.quantity})`).join(', ').length > 50 ? '...' : ''))
                            : "Payment Record"
                        }
                         {entry.relatedInvoiceId && entry.entryPurpose === "Payment Record" && <span className="block text-muted-foreground text-[10px]">Inv: {allInvoices.find(i => i.id === entry.relatedInvoiceId)?.invoiceNumber || `Ref: ${entry.relatedInvoiceId.substring(0,6)}...`}</span>}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(entry.grandTotal)}</TableCell>
                      <TableCell className="capitalize">
                        {entry.paymentStatus ? entry.paymentStatus.charAt(0).toUpperCase() + entry.paymentStatus.slice(1) : "N/A"}
                        {entry.paymentMethod ? ` (${entry.paymentMethod})` : ''}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Button variant="link" size="sm" className="p-0 h-auto text-xs font-normal text-current hover:text-primary" onClick={() => handleUserFilterClick(entry.createdByName || 'Unknown User')}>
                            <div className="flex items-center gap-1.5">
                                <UserCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>
                                {entry.createdByName || "N/A"}
                            </div>
                        </Button>
                         {entry.updatedByName && (
                            <Button variant="link" size="sm" className="p-0 h-auto text-xs font-normal text-muted-foreground hover:text-primary block mt-0.5" onClick={() => handleUserFilterClick(entry.updatedByName || 'Unknown Modifier')}>
                                <div className="flex items-center gap-1.5">
                                    <Edit className="h-3 w-3 text-muted-foreground/70 shrink-0"/>
                                    {entry.updatedByName}
                                </div>
                            </Button>
                        )}
                      </TableCell>
                       <TableCell className="text-right">
                           <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEntryDetailsDialog(entry)} title="View Full Details">
                                <Eye className="h-4 w-4"/> <span className="sr-only">View Details</span>
                            </Button>
                            {currentUserRole === 'admin' && (
                               <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                    <span className="sr-only">More actions</span>
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
                            )}
                           </div>
                        </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Mobile/Tablet View: Cards */}
            <div className="block lg:hidden space-y-4">
                {displayedLedgerEntries.map(entry => (
                    <Card key={entry.id + "-mobile"} className="w-full">
                        <CardHeader className="flex flex-row items-start justify-between gap-2 p-4">
                            <div className="flex-1 space-y-1">
                                <CardTitle className="text-base font-bold">{entry.entityName}</CardTitle>
                                <CardDescription className="text-xs">
                                    <Badge 
                                        variant={entry.type === 'sale' ? 'default' : 'secondary'} 
                                        className={`mr-2 ${
                                            entry.entryPurpose === "Payment Record" ? (entry.type === 'sale' ? "bg-teal-100 text-teal-700 dark:bg-teal-700/80 dark:text-teal-100" : "bg-purple-100 text-purple-700 dark:bg-purple-700/80 dark:text-purple-100") :
                                            (entry.type === 'sale' ? 'bg-green-100 text-green-700 dark:bg-green-700/80 dark:text-green-100' : 'bg-blue-100 text-blue-700 dark:bg-blue-700/80 dark:text-blue-100')
                                        } whitespace-nowrap`}
                                    >
                                        {entry.entryPurpose === "Payment Record" ? (entry.type === 'sale' ? 'Payment Received' : 'Payment Sent') : entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                                    </Badge>
                                    <span className="capitalize">{entry.paymentStatus} {entry.paymentMethod ? `(${entry.paymentMethod})` : ''}</span>
                                </CardDescription>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                    <MoreHorizontal className="h-4 w-4" /> <span className="sr-only">Actions</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEntryDetailsDialog(entry)}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                                    {currentUserRole === 'admin' && <DropdownMenuItem onClick={() => handleEditLedgerEntry(entry)}><Edit className="mr-2 h-4 w-4" /> Edit Entry</DropdownMenuItem>}
                                    {currentUserRole === 'admin' && <DropdownMenuSeparator/>}
                                    {currentUserRole === 'admin' && <DropdownMenuItem onClick={() => openDeleteConfirmation(entry)} className="text-destructive focus:text-destructive-foreground"><Trash2 className="mr-2 h-4 w-4" /> Delete Entry</DropdownMenuItem>}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardHeader>
                        <CardContent className="p-4 pt-0 text-sm">
                             <div className="flex justify-between items-center font-semibold text-lg mb-2">
                                <span className="text-muted-foreground text-sm">Total</span>
                                <span>{formatCurrency(entry.grandTotal)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                                <strong className="font-medium text-foreground">Details:</strong> {entry.entryPurpose === "Ledger Record" ? (entry.items.map(i => i.productName).join(', ') || 'No items') : `Payment via ${entry.paymentMethod || 'N/A'}`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                <strong className="font-medium text-foreground">User:</strong> {entry.createdByName}
                            </p>
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






