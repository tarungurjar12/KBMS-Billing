
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { CreditCard, PlusCircle, MoreHorizontal, Edit, Trash2, DollarSign, FileWarning, TrendingUp, AlertCircle, Activity } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, addDoc, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';

/**
 * @fileOverview Page for Admin to manage Payment Records in Firestore.
 * Includes a dashboard section for payment summaries.
 */

export const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "ACH", "Check", "Other"] as const;
export const PAYMENT_STATUSES = ["Completed", "Pending", "Failed", "Sent", "Received", "Partial"] as const;
const PAYMENT_TYPES = ["customer", "supplier"] as const;


export interface PaymentRecord {
  id: string;
  type: "customer" | "supplier";
  relatedEntityName: string;
  relatedEntityId: string;
  relatedInvoiceId: string | null;
  date: string; // Formatted for display
  isoDate: string; // ISO string for storing and sorting
  amountPaid: number; // The amount of THIS payment transaction
  displayAmountPaid: string;
  originalInvoiceAmount: number | null; // Original total of the invoice/ledger this payment is for (useful for partial)
  remainingBalanceOnInvoice: number | null; // Calculated, if originalInvoiceAmount and amountPaid are present
  method: typeof PAYMENT_METHODS[number] | null;
  transactionId: string | null;
  status: typeof PAYMENT_STATUSES[number];
  notes: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  ledgerEntryId?: string | null; // Link back to a ledger entry if created from one
}

interface PaymentMetric {
  title: string;
  value: string;
  icon: React.ElementType;
  isLoading: boolean;
}


// Base schema without conditional method requirement
const paymentRecordBaseSchema = z.object({
  type: z.enum(PAYMENT_TYPES, { required_error: "Payment type is required." }),
  relatedEntityName: z.string().min(1, "Entity name is required."),
  relatedEntityId: z.string().min(1, "Entity ID is required."),
  relatedInvoiceId: z.string().nullable().optional().transform(val => (val === undefined || String(val).trim() === "") ? null : String(val).trim()),
  isoDate: z.string().refine((date) => !isNaN(parseISO(date).valueOf()), { message: "A valid payment date is required." }),
  amountPaid: z.preprocess(
    (val) => parseFloat(String(val).replace(/[^0-9.]+/g, "")),
    z.number({invalid_type_error: "Amount paid must be a valid number."}).positive({ message: "Amount paid must be a positive value." })
  ),
  originalInvoiceAmount: z.preprocess(
    (val) => (String(val || "").trim() === "" || String(val) === "0" ? null : parseFloat(String(val).replace(/[^0-9.]+/g, ""))),
    z.number().positive({ message: "Original amount must be positive if provided." }).nullable().optional()
  ),
  method: z.enum(PAYMENT_METHODS).nullable().optional().transform(val => (val === undefined || val === "") ? null : val),
  transactionId: z.string().nullable().optional().transform(val => (val === undefined || String(val).trim() === "") ? null : String(val).trim()),
  status: z.enum(PAYMENT_STATUSES, { required_error: "Payment status is required." }),
  notes: z.string().nullable().optional().transform(val => (val === undefined || String(val).trim() === "") ? null : String(val).trim()),
  ledgerEntryId: z.string().nullable().optional().transform(val => (val === undefined || String(val).trim() === "") ? null : String(val).trim()),
});

// Refined schema to make 'method' required for specific statuses
const paymentRecordSchema = paymentRecordBaseSchema.superRefine((data, ctx) => {
  if ((data.status === "Completed" || data.status === "Partial" || data.status === "Received") && !data.method) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Payment method is required for Completed, Partial, or Received status.",
      path: ["method"],
    });
  }
  if (data.status === "Partial" && data.originalInvoiceAmount && data.amountPaid >= data.originalInvoiceAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "For partial payments, amount paid must be less than the original invoice amount.",
      path: ["amountPaid"],
    });
  }
});


type PaymentFormValues = z.infer<typeof paymentRecordSchema>;

const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PaymentsPage() {
  const { toast } = useToast();
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [paymentMetrics, setPaymentMetrics] = useState<PaymentMetric[]>([
    { title: "Total Received (Customer)", value: "₹0.00", icon: DollarSign, isLoading: true },
    { title: "Total Pending (Customer)", value: "₹0.00", icon: AlertCircle, isLoading: true },
    { title: "Total Sent (Supplier)", value: "₹0.00", icon: TrendingUp, isLoading: true },
    { title: "Today's Received", value: "₹0.00", icon: DollarSign, isLoading: true },
    { title: "Today's Pending", value: "₹0.00", icon: AlertCircle, isLoading: true },
    { title: "Today's Sent", value: "₹0.00", icon: TrendingUp, isLoading: true },
  ]);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentRecordSchema),
    defaultValues: {
      type: "customer", isoDate: new Date().toISOString().split('T')[0],
      status: "Completed", method: "Cash",
      relatedEntityName: "", relatedEntityId: "",
      amountPaid: 0, originalInvoiceAmount: null,
      relatedInvoiceId: null, transactionId: null, notes: null, ledgerEntryId: null
    },
  });

  const paymentStatusWatcher = form.watch("status");
  const originalInvoiceAmountWatcher = form.watch("originalInvoiceAmount");
  const amountPaidWatcher = form.watch("amountPaid");

  const shouldShowPaymentMethod = paymentStatusWatcher === "Completed" || paymentStatusWatcher === "Partial" || paymentStatusWatcher === "Received";
  const isPartialPayment = paymentStatusWatcher === "Partial";
  const calculatedRemainingBalance = (originalInvoiceAmountWatcher && amountPaidWatcher && isPartialPayment)
    ? originalInvoiceAmountWatcher - amountPaidWatcher
    : null;


  useEffect(() => {
    if (form.formState.isDirty || editingPayment) { // Only run on dirty form or when editing
        if (!shouldShowPaymentMethod) {
            form.setValue("method", null, { shouldDirty: true });
        } else if (shouldShowPaymentMethod && !form.getValues("method")) {
            form.setValue("method", "Cash", { shouldDirty: true }); // Default if shown and empty
        }
    }
  }, [shouldShowPaymentMethod, form, editingPayment]);

  const fetchPaymentsAndMetrics = useCallback(async () => {
    setIsLoading(true);
    setIsLoadingMetrics(true);
    try {
      // Firestore Index Required: payments collection, isoDate (DESC)
      const q = query(collection(db, "payments"), orderBy("isoDate", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedPayments = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        let paymentDate = "N/A";
        if (data.isoDate) {
             if (typeof data.isoDate === 'string') {
                try { paymentDate = format(parseISO(data.isoDate), "MMM dd, yyyy"); } catch (e) { console.warn("Invalid isoDate string format:", data.isoDate, e); paymentDate = "Invalid Date"; }
            } else if (data.isoDate instanceof Timestamp) { paymentDate = format(data.isoDate.toDate(), "MMM dd, yyyy"); }
        } else if (data.createdAt instanceof Timestamp) { paymentDate = format(data.createdAt.toDate(), "MMM dd, yyyy"); }
        
        const originalAmount = data.originalInvoiceAmount || null;
        const paidAmount = data.amountPaid || 0;
        let remainingBalance = null;
        if (originalAmount && (data.status === 'Partial' || data.status === 'Pending')) {
            remainingBalance = originalAmount - paidAmount;
        }

        return {
          id: docSnapshot.id, type: data.type || 'customer',
          relatedEntityName: data.relatedEntityName || 'N/A', relatedEntityId: data.relatedEntityId || '',
          relatedInvoiceId: data.relatedInvoiceId || null, date: paymentDate,
          isoDate: typeof data.isoDate === 'string' ? data.isoDate : (data.isoDate instanceof Timestamp ? data.isoDate.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
          amountPaid: paidAmount,
          displayAmountPaid: formatCurrency(paidAmount),
          originalInvoiceAmount: originalAmount,
          remainingBalanceOnInvoice: remainingBalance,
          method: data.method || null,
          transactionId: data.transactionId || null,
          status: data.status || 'Pending',
          notes: data.notes || null, createdAt: data.createdAt, updatedAt: data.updatedAt,
          ledgerEntryId: data.ledgerEntryId || null,
        } as PaymentRecord;
      });
      setAllPayments(fetchedPayments);

      // Calculate Metrics
      const todayISOStart = startOfDay(new Date()).toISOString().split('T')[0];
      const todayISOEnd = endOfDay(new Date()).toISOString().split('T')[0];


      let totalReceived = 0, totalPending = 0, totalSent = 0;
      let todayReceived = 0, todayPending = 0, todaySent = 0;

      fetchedPayments.forEach(p => {
        const paymentIsoDateOnly = p.isoDate.split('T')[0];
        const isToday = paymentIsoDateOnly === todayISOStart; // Simpler date comparison

        if (p.type === 'customer') {
          if (p.status === 'Completed' || p.status === 'Received' || p.status === 'Partial') {
            totalReceived += p.amountPaid;
            if (isToday) todayReceived += p.amountPaid;
          }
          if (p.status === 'Pending' || (p.status === 'Partial' && p.remainingBalanceOnInvoice && p.remainingBalanceOnInvoice > 0)) {
            const pendingAmount = p.remainingBalanceOnInvoice ?? p.originalInvoiceAmount ?? p.amountPaid; 
            totalPending += pendingAmount;
            if (isToday) todayPending += pendingAmount;
          }
        } else { // supplier
          if (p.status === 'Completed' || p.status === 'Sent' || p.status === 'Partial') {
            totalSent += p.amountPaid;
            if (isToday) todaySent += p.amountPaid;
          }
        }
      });

      setPaymentMetrics([
        { title: "Total Received (Customer)", value: formatCurrency(totalReceived), icon: DollarSign, isLoading: false },
        { title: "Total Pending (Customer)", value: formatCurrency(totalPending), icon: AlertCircle, isLoading: false },
        { title: "Total Sent (Supplier)", value: formatCurrency(totalSent), icon: TrendingUp, isLoading: false },
        { title: "Today's Received", value: formatCurrency(todayReceived), icon: DollarSign, isLoading: false },
        { title: "Today's Pending", value: formatCurrency(todayPending), icon: AlertCircle, isLoading: false },
        { title: "Today's Sent", value: formatCurrency(todaySent), icon: TrendingUp, isLoading: false },
      ]);

    } catch (error: any) {
      console.error("Error fetching payments: ", error);
       if (error.code === 'failed-precondition') {
        toast({
            title: "Database Index Required",
            description: `A query for payments failed. Firestore index 'payments' (isoDate DESC) likely needed. Check console for exact link.`,
            variant: "destructive", duration: 15000,
        });
      } else {
        toast({ title: "Database Error", description: `Could not load payment records: ${error.message}`, variant: "destructive" });
      }
      setPaymentMetrics(prev => prev.map(m => ({ ...m, value: "Error", isLoading: false })));
    } finally {
      setIsLoading(false);
      setIsLoadingMetrics(false);
    }
  }, [toast]);

  useEffect(() => { fetchPaymentsAndMetrics(); }, [fetchPaymentsAndMetrics]);

  useEffect(() => {
    if (isFormDialogOpen) {
      if (editingPayment) {
        form.reset({
          ...editingPayment,
          isoDate: editingPayment.isoDate ? editingPayment.isoDate.split('T')[0] : new Date().toISOString().split('T')[0],
          // The Zod schema transforms will handle null conversion for these from the editingPayment object
          method: editingPayment.method, 
          relatedInvoiceId: editingPayment.relatedInvoiceId,
          transactionId: editingPayment.transactionId,
          notes: editingPayment.notes,
          originalInvoiceAmount: editingPayment.originalInvoiceAmount,
          ledgerEntryId: editingPayment.ledgerEntryId,
        });
      } else {
        form.reset({
          type: "customer", isoDate: new Date().toISOString().split('T')[0], status: "Completed", method: "Cash",
          relatedEntityName: "", relatedEntityId: "", amountPaid: 0,
          relatedInvoiceId: null, transactionId: null, notes: null, originalInvoiceAmount: null, ledgerEntryId: null
        });
      }
    }
  }, [editingPayment, isFormDialogOpen, form]);

  const handleFormSubmit = async (values: PaymentFormValues) => {
    try {
      let remainingBalance = null;
      if (values.status === 'Partial' && values.originalInvoiceAmount && values.amountPaid) {
        remainingBalance = values.originalInvoiceAmount - values.amountPaid;
         if (remainingBalance < 0) remainingBalance = 0; // Ensure remaining balance is not negative
      }

      // 'values' object is already transformed by Zod, so fields like notes, transactionId etc.,
      // will be null if they were empty or undefined, due to the updated transforms.
      const dataToSave: Partial<Omit<PaymentRecord, 'id' | 'date' | 'displayAmountPaid'>> & {updatedAt: any, displayAmountPaid: string, createdAt?: any, remainingBalanceOnInvoice?: number | null} = {
        ...values, // Spread validated and transformed values
        displayAmountPaid: formatCurrency(values.amountPaid),
        remainingBalanceOnInvoice: remainingBalance,
        updatedAt: serverTimestamp(),
      };
      
      // Remove id and date from dataToSave as they are part of PaymentRecord but not what we save directly
      // (id is doc ID, date is derived from isoDate).
      // Also, displayAmountPaid is for UI, not storage.
      // The Omit in type helps, but ensure the object itself is clean.
      delete (dataToSave as any).id;
      delete (dataToSave as any).date;
      

      if (editingPayment) {
        const paymentRef = doc(db, "payments", editingPayment.id);
        await updateDoc(paymentRef, dataToSave);
        toast({ title: "Payment Updated", description: "Payment record updated successfully." });
      } else {
        dataToSave.createdAt = serverTimestamp();
        await addDoc(collection(db, "payments"), dataToSave);
        toast({ title: "Payment Added", description: "New payment record added successfully." });
      }
      fetchPaymentsAndMetrics(); setIsFormDialogOpen(false); setEditingPayment(null); form.reset();
    } catch (error: any) {
      console.error("Error saving payment: ", error);
      toast({ title: "Save Error", description: `Could not save payment record: ${error.message}`, variant: "destructive" });
    }
  };

  const openAddDialog = () => { setEditingPayment(null); setIsFormDialogOpen(true); };
  const openEditDialog = (payment: PaymentRecord) => { setEditingPayment(payment); setIsFormDialogOpen(true); };

  const handleDeletePayment = async (paymentId: string, paymentDetails: string) => {
    try {
        await deleteDoc(doc(db, "payments", paymentId));
        toast({ title: "Payment Deleted", description: `Payment record for ${paymentDetails} deleted successfully.` });
        fetchPaymentsAndMetrics();
    } catch (error: any) {
        console.error("Error deleting payment: ", error);
        toast({ title: "Deletion Error", description: `Could not delete payment record: ${error.message}`, variant: "destructive" });
    }
  };

  const getBadgeVariant = (status: PaymentRecord['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "Completed": case "Received": return "default";
      case "Pending": case "Sent": return "secondary";
      case "Failed": return "destructive";
      case "Partial": return "outline";
      default: return "secondary";
    }
  };

  const customerPayments = allPayments.filter(p => p.type === "customer");
  const supplierPayments = allPayments.filter(p => p.type === "supplier");

  const renderPaymentTable = (payments: PaymentRecord[], type: "customer" | "supplier") => (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader><TableRow>
          <TableHead>Date</TableHead>
          <TableHead>{type === "customer" ? "Customer" : "Supplier"} Name</TableHead>
          <TableHead>Ref ID</TableHead>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Amount Paid (₹)</TableHead>
          <TableHead className="text-right">Original Amt (₹)</TableHead>
          <TableHead className="text-right">Balance Due (₹)</TableHead>
          <TableHead className="text-center">Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>{payment.date}</TableCell>
            <TableCell>{payment.relatedEntityName}</TableCell>
            <TableCell>{payment.relatedInvoiceId || payment.ledgerEntryId || "N/A"}</TableCell>
            <TableCell>{payment.method || "N/A"}</TableCell>
            <TableCell className="text-right">{payment.displayAmountPaid}</TableCell>
            <TableCell className="text-right">{payment.originalInvoiceAmount ? formatCurrency(payment.originalInvoiceAmount) : "N/A"}</TableCell>
            <TableCell className="text-right">{payment.remainingBalanceOnInvoice !== null ? formatCurrency(payment.remainingBalanceOnInvoice) : "N/A"}</TableCell>
            <TableCell className="text-center">
              <Badge
                variant={getBadgeVariant(payment.status)}
                className={
                    (payment.status === "Completed" || payment.status === "Received") ? "bg-accent text-accent-foreground" :
                    payment.status === "Partial" ? "border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-300 bg-transparent" :
                    (payment.status === "Pending" || payment.status === "Sent") ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300 bg-transparent" :
                    ""
                }
              >{payment.status}</Badge>
            </TableCell>
             <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Actions for payment {payment.id}</span></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEditDialog(payment)}><Edit className="mr-2 h-4 w-4" /> Edit Record</DropdownMenuItem>
                  {/* Ledger-originated payments might be non-deletable or have special handling */}
                  <DropdownMenuItem 
                    onClick={() => handleDeletePayment(payment.id, `${payment.relatedEntityName} - ${payment.displayAmountPaid}`)} 
                    className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground"
                    disabled={!!payment.ledgerEntryId} // Example: Disable delete if linked to ledger
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Record
                  </DropdownMenuItem>
                  {!!payment.ledgerEntryId && <DropdownMenuItem disabled><span className="text-xs text-muted-foreground">Linked to ledger</span></DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Payment Records"
        description="Track and manage all customer and supplier payments. (Admin Access)"
        icon={CreditCard}
        actions={<Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Record New Payment</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
        {paymentMetrics.map((metric) => (
          <Card key={metric.title} className="shadow-md rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{metric.title}</CardTitle>
              <metric.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {metric.isLoading ? (
                <div className="text-2xl font-bold animate-pulse">Loading...</div>
              ) : (
                <div className="text-2xl font-bold">{metric.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>


      <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => {
          if(!isOpen) { setIsFormDialogOpen(false); setEditingPayment(null); form.reset(); } else { setIsFormDialogOpen(isOpen); }
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingPayment ? "Edit Payment Record" : "Record New Payment"}</DialogTitle>
            <DialogDescription>
              {editingPayment ? `Update details for payment ID: ${editingPayment.id}` : "Fill in the details for the new payment record."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-4">
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem><FormLabel>Payment Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!!editingPayment && !!editingPayment.ledgerEntryId}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select payment type" /></SelectTrigger></FormControl>
                    <SelectContent>{PAYMENT_TYPES.map(type => <SelectItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)} Payment</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>)}
              />
              <FormField control={form.control} name="relatedEntityName" render={({ field }) => (<FormItem><FormLabel>{form.watch("type") === "customer" ? "Customer Name" : "Supplier Name"}</FormLabel><FormControl><Input placeholder={`Enter ${form.watch("type")} name`} {...field} readOnly={!!editingPayment && !!editingPayment.ledgerEntryId} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="relatedEntityId" render={({ field }) => (<FormItem><FormLabel>{form.watch("type") === "customer" ? "Customer ID" : "Supplier ID"} (from database)</FormLabel><FormControl><Input placeholder={`Enter ${form.watch("type")} Firestore ID`} {...field} readOnly={!!editingPayment && !!editingPayment.ledgerEntryId} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="relatedInvoiceId" render={({ field }) => (<FormItem><FormLabel>Related Invoice/PO/Ledger ID (Optional)</FormLabel><FormControl><Input placeholder="e.g., INV00123 or Ledger ID" {...field} value={field.value ?? ""} readOnly={!!editingPayment && !!editingPayment.ledgerEntryId} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="isoDate" render={({ field }) => (<FormItem><FormLabel>Payment Date</FormLabel><FormControl><Input type="date" {...field} readOnly={!!editingPayment && !!editingPayment.ledgerEntryId}/></FormControl><FormMessage /></FormItem>)} />

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Payment Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!!editingPayment && !!editingPayment.ledgerEntryId}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select payment status" /></SelectTrigger></FormControl>
                    <SelectContent>{PAYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>)}
              />
               {shouldShowPaymentMethod && (
                <FormField control={form.control} name="method" render={({ field }) => (
                  <FormItem><FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""} disabled={!!editingPayment && !!editingPayment.ledgerEntryId}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger></FormControl>
                      <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>)}
                />
              )}
              {isPartialPayment && (
                <FormField control={form.control} name="originalInvoiceAmount" render={({ field }) => (
                    <FormItem><FormLabel>Original Invoice Amount (₹)</FormLabel>
                        <FormControl><Input type="number" step="0.01" placeholder="e.g., 2000.00" {...field} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)} value={field.value ?? ""} readOnly={!!editingPayment && !!editingPayment.ledgerEntryId} /></FormControl>
                        <FormMessage />
                    </FormItem>)} />
              )}
              <FormField control={form.control} name="amountPaid" render={({ field }) => (
                <FormItem><FormLabel>{isPartialPayment ? "Amount Paid Now (₹)" : "Amount Paid (₹)"}</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="e.g., 1000.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} readOnly={!!editingPayment && !!editingPayment.ledgerEntryId} /></FormControl>
                    <FormMessage />
                </FormItem>)}
              />
              {isPartialPayment && calculatedRemainingBalance !== null && (
                <FormItem>
                    <FormLabel>Remaining Balance on Invoice</FormLabel>
                    <Input value={formatCurrency(calculatedRemainingBalance < 0 ? 0 : calculatedRemainingBalance)} readOnly className="bg-muted/50" />
                </FormItem>
              )}
              <FormField control={form.control} name="transactionId" render={({ field }) => (<FormItem><FormLabel>Transaction ID / Check No. (Optional)</FormLabel><FormControl><Input placeholder="e.g., Bank transaction reference" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Any additional notes about this payment..." {...field} rows={3} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 border-t -mx-6 px-6">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting || (!!editingPayment && !!editingPayment.ledgerEntryId && editingPayment.status !== 'Partial')}>
                  {form.formState.isSubmitting ? (editingPayment ? "Saving Changes..." : "Adding Payment...") : (editingPayment ? "Save Changes" : "Add Payment Record")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="customer_payments" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:w-auto sm:grid-cols-2 mb-4">
          <TabsTrigger value="customer_payments" className="whitespace-nowrap px-3">Customer Payments</TabsTrigger>
          <TabsTrigger value="supplier_payments" className="whitespace-nowrap px-3">Supplier Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="customer_payments">
          <Card className="shadow-lg rounded-xl">
            <CardHeader><CardTitle className="font-headline text-foreground">Customer Payment History</CardTitle><CardDescription>Records of payments received from customers, most recent first.</CardDescription></CardHeader>
            <CardContent>
                {isLoading && customerPayments.length === 0 ? (
                     <div className="text-center py-10 text-muted-foreground"><Activity className="mx-auto h-12 w-12 mb-4 animate-spin" />Loading...</div>
                ) : customerPayments.length > 0 ? renderPaymentTable(customerPayments, "customer") : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <FileWarning className="h-16 w-16 text-muted-foreground mb-4" />
                        <p className="text-xl font-semibold text-muted-foreground">No Customer Payments Recorded</p>
                        <p className="text-sm text-muted-foreground mb-6">Track payments received from your customers here.</p>
                        <Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Record First Customer Payment</Button>
                    </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="supplier_payments">
          <Card className="shadow-lg rounded-xl">
            <CardHeader><CardTitle className="font-headline text-foreground">Supplier Payment History</CardTitle><CardDescription>Records of payments made to suppliers/vendors, most recent first.</CardDescription></CardHeader>
            <CardContent>
                 {isLoading && supplierPayments.length === 0 ? (
                     <div className="text-center py-10 text-muted-foreground"><Activity className="mx-auto h-12 w-12 mb-4 animate-spin" />Loading...</div>
                ) : supplierPayments.length > 0 ? renderPaymentTable(supplierPayments, "supplier") : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <FileWarning className="h-16 w-16 text-muted-foreground mb-4" />
                        <p className="text-xl font-semibold text-muted-foreground">No Supplier Payments Recorded</p>
                        <p className="text-sm text-muted-foreground mb-6">Keep track of payments made to your suppliers.</p>
                        <Button onClick={() => {form.setValue("type", "supplier"); openAddDialog();}}><PlusCircle className="mr-2 h-4 w-4" />Record First Supplier Payment</Button>
                    </div>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

