
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; 
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { CreditCard, PlusCircle, MoreHorizontal, Edit, Trash2, DollarSign, FileWarning } from "lucide-react"; 
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
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import { format, parseISO } from 'date-fns';

/**
 * @fileOverview Page for Admin to manage Payment Records in Firestore.
 */

/**
 * Interface representing a Payment Record document in Firestore.
 */
export interface PaymentRecord {
  id: string; 
  type: "customer" | "supplier"; 
  relatedEntityName: string; 
  relatedEntityId: string; 
  relatedInvoiceId: string | null; 
  date: string; 
  isoDate: string; 
  amountPaid: number; // Amount actually paid in this transaction
  displayAmountPaid: string; 
  originalInvoiceAmount?: number | null; // Optional: Total amount of the invoice being partially paid
  method: "Cash" | "UPI" | "Card" | "Bank Transfer" | "ACH" | "Check" | "Other"; 
  transactionId: string | null; 
  status: "Completed" | "Pending" | "Failed" | "Sent" | "Received" | "Partial"; 
  notes: string | null; 
  createdAt?: Timestamp; 
  updatedAt?: Timestamp;
}

// Constants
const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "ACH", "Check", "Other"] as const;
const PAYMENT_STATUSES = ["Completed", "Pending", "Failed", "Sent", "Received", "Partial"] as const;
const PAYMENT_TYPES = ["customer", "supplier"] as const;

// Zod schema
const paymentRecordSchema = z.object({
  type: z.enum(PAYMENT_TYPES, { required_error: "Payment type is required." }),
  relatedEntityName: z.string().min(1, "Entity name is required."),
  relatedEntityId: z.string().min(1, "Entity ID is required."), 
  relatedInvoiceId: z.string().optional(),
  isoDate: z.string().refine((date) => !isNaN(parseISO(date).valueOf()), { message: "A valid payment date is required." }),
  amountPaid: z.preprocess(
    (val) => parseFloat(String(val).replace(/[^0-9.]+/g, "")), 
    z.number({invalid_type_error: "Amount paid must be a valid number."}).positive({ message: "Amount paid must be a positive value." })
  ),
  originalInvoiceAmount: z.preprocess(
    (val) => (String(val).trim() === "" || String(val) === "0" ? undefined : parseFloat(String(val).replace(/[^0-9.]+/g, ""))),
    z.number().positive({ message: "Original amount must be positive if provided." }).optional()
  ),
  method: z.enum(PAYMENT_METHODS, { required_error: "Payment method is required." }),
  transactionId: z.string().optional(),
  status: z.enum(PAYMENT_STATUSES, { required_error: "Payment status is required." }),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentRecordSchema>;

const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PaymentsPage() {
  const { toast } = useToast();
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentRecordSchema),
    defaultValues: { 
      type: "customer", 
      isoDate: new Date().toISOString().split('T')[0], 
      status: "Completed", 
      method: "Cash",
      relatedEntityName: "",
      relatedEntityId: "",
      amountPaid: 0, 
      originalInvoiceAmount: undefined,
    },
  });

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
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
        return { 
          id: docSnapshot.id,
          type: data.type || 'customer', 
          relatedEntityName: data.relatedEntityName || 'N/A',
          relatedEntityId: data.relatedEntityId || '',
          relatedInvoiceId: data.relatedInvoiceId || null,
          date: paymentDate,
          isoDate: typeof data.isoDate === 'string' ? data.isoDate : (data.isoDate instanceof Timestamp ? data.isoDate.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
          amountPaid: data.amountPaid || data.amount || 0, // data.amount for backward compatibility
          displayAmountPaid: formatCurrency(data.amountPaid || data.amount || 0),
          originalInvoiceAmount: data.originalInvoiceAmount || null,
          method: data.method || 'Other',
          transactionId: data.transactionId || null,
          status: data.status || 'Pending',
          notes: data.notes || null,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        } as PaymentRecord;
      });
      setAllPayments(fetchedPayments);
    } catch (error: any) {
      console.error("Error fetching payments: ", error);
       if (error.code === 'failed-precondition') {
        toast({
            title: "Database Index Required",
            description: `A query for payments failed. Please create the required Firestore index for 'payments' (orderBy 'isoDate' descending). Check your browser's developer console for a Firebase link to create it.`,
            variant: "destructive",
            duration: 15000,
        });
      } else {
        toast({ title: "Database Error", description: `Could not load payment records: ${error.message}`, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    if (isFormDialogOpen) {
      if (editingPayment) {
        form.reset({
          ...editingPayment,
          isoDate: editingPayment.isoDate ? editingPayment.isoDate.split('T')[0] : new Date().toISOString().split('T')[0],
          relatedInvoiceId: editingPayment.relatedInvoiceId || "",
          transactionId: editingPayment.transactionId || "",
          notes: editingPayment.notes || "",
          originalInvoiceAmount: editingPayment.originalInvoiceAmount || undefined,
        });
      } else {
        form.reset({ 
          type: "customer", isoDate: new Date().toISOString().split('T')[0], status: "Completed", method: "Cash", 
          relatedEntityName: "", relatedEntityId: "", relatedInvoiceId: "", amountPaid: 0, transactionId: "", notes: "", originalInvoiceAmount: undefined,
        });
      }
    }
  }, [editingPayment, isFormDialogOpen, form]);

  const handleFormSubmit = async (values: PaymentFormValues) => {
    try {
      const dataToSave = {
        ...values,
        displayAmountPaid: formatCurrency(values.amountPaid),
        updatedAt: serverTimestamp(),
        relatedInvoiceId: values.relatedInvoiceId || null,
        transactionId: values.transactionId || null,
        notes: values.notes || null,
        originalInvoiceAmount: values.originalInvoiceAmount || null,
      };

      if (editingPayment) { 
        const paymentRef = doc(db, "payments", editingPayment.id);
        await updateDoc(paymentRef, dataToSave); 
        toast({ title: "Payment Updated", description: "Payment record updated successfully." });
      } else { 
        await addDoc(collection(db, "payments"), {...dataToSave, createdAt: serverTimestamp()});
        toast({ title: "Payment Added", description: "New payment record added successfully." });
      }
      fetchPayments(); 
      setIsFormDialogOpen(false); 
      setEditingPayment(null); 
      form.reset(); 
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
        fetchPayments(); 
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

  if (isLoading) {
    return <PageHeader title="Payment Records" description="Loading payment data..." icon={CreditCard} />;
  }

  const customerPayments = allPayments.filter(p => p.type === "customer");
  const supplierPayments = allPayments.filter(p => p.type === "supplier");

  const renderPaymentTable = (payments: PaymentRecord[], type: "customer" | "supplier") => (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader><TableRow>
          <TableHead>Date</TableHead>
          <TableHead>{type === "customer" ? "Customer" : "Supplier"} Name</TableHead>
          <TableHead>Invoice ID</TableHead>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Amount Paid (₹)</TableHead>
          {type === "customer" && <TableHead className="text-right">Original Due (₹)</TableHead>}
          <TableHead className="text-center">Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>{payment.date}</TableCell>
            <TableCell>{payment.relatedEntityName}</TableCell>
            <TableCell>{payment.relatedInvoiceId || "N/A"}</TableCell>
            <TableCell>{payment.method}</TableCell>
            <TableCell className="text-right">{payment.displayAmountPaid}</TableCell>
            {type === "customer" && <TableCell className="text-right">{payment.originalInvoiceAmount ? formatCurrency(payment.originalInvoiceAmount) : "N/A"}</TableCell>}
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
                  <DropdownMenuItem onClick={() => handleDeletePayment(payment.id, `${payment.relatedEntityName} - ${payment.displayAmountPaid}`)} className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Record
                  </DropdownMenuItem>
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select payment type" /></SelectTrigger></FormControl>
                    <SelectContent>{PAYMENT_TYPES.map(type => <SelectItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)} Payment</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>)}
              />
              <FormField control={form.control} name="relatedEntityName" render={({ field }) => (<FormItem><FormLabel>{form.watch("type") === "customer" ? "Customer Name" : "Supplier Name"}</FormLabel><FormControl><Input placeholder={`Enter ${form.watch("type")} name`} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="relatedEntityId" render={({ field }) => (<FormItem><FormLabel>{form.watch("type") === "customer" ? "Customer ID" : "Supplier ID"} (from database)</FormLabel><FormControl><Input placeholder={`Enter ${form.watch("type")} Firestore ID`} {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="relatedInvoiceId" render={({ field }) => (<FormItem><FormLabel>Related Invoice/PO ID (Optional)</FormLabel><FormControl><Input placeholder="e.g., INV00123 or PO-789" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="isoDate" render={({ field }) => (<FormItem><FormLabel>Payment Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="amountPaid" render={({ field }) => (<FormItem><FormLabel>Amount Paid (₹)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 1000.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
              {form.watch("status") === "Partial" && form.watch("type") === "customer" && (
                <FormField control={form.control} name="originalInvoiceAmount" render={({ field }) => (<FormItem><FormLabel>Original Invoice Amount (₹) (Optional)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 2000.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || undefined)} /></FormControl><FormMessage /></FormItem>)} />
              )}
              <FormField control={form.control} name="method" render={({ field }) => (
                <FormItem><FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger></FormControl>
                    <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>)}
              />
              <FormField control={form.control} name="transactionId" render={({ field }) => (<FormItem><FormLabel>Transaction ID / Check No. (Optional)</FormLabel><FormControl><Input placeholder="e.g., Bank transaction reference" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Payment Status</FormLabel>
                  <Select onValueChange={(value) => {
                      field.onChange(value);
                      if (value !== "Partial") {
                          form.setValue("originalInvoiceAmount", undefined); // Clear if not partial
                      }
                  }} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select payment status" /></SelectTrigger></FormControl>
                    <SelectContent>{PAYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>)}
              />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Any additional notes about this payment..." {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 border-t -mx-6 px-6">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (editingPayment ? "Saving Changes..." : "Adding Payment...") : (editingPayment ? "Save Changes" : "Add Payment Record")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="customer_payments" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:w-auto md:max-w-lg mb-4">
          <TabsTrigger value="customer_payments">Customer Payments (Received)</TabsTrigger>
          <TabsTrigger value="supplier_payments">Supplier Payments (Made)</TabsTrigger>
        </TabsList>
        <TabsContent value="customer_payments">
          <Card className="shadow-lg rounded-xl">
            <CardHeader><CardTitle className="font-headline text-foreground">Customer Payment History</CardTitle><CardDescription>Records of payments received from customers, most recent first.</CardDescription></CardHeader>
            <CardContent>
                {customerPayments.length > 0 ? renderPaymentTable(customerPayments, "customer") : (
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
                {supplierPayments.length > 0 ? renderPaymentTable(supplierPayments, "supplier") : (
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

