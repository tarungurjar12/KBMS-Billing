
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { CreditCard, PlusCircle, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
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
 * Allows Admin to:
 *  - Track and manage payment status for both customer and supplier payments.
 *  - Manually record payments (customer incoming, supplier outgoing).
 *  - View payment history.
 * Supplier payments are strictly Admin-only.
 */

export interface PaymentRecord {
  id: string; // Firestore document ID
  type: "customer" | "supplier";
  relatedEntityName: string; // Customer Name or Supplier Name
  relatedEntityId: string; // Customer ID or Supplier ID
  relatedInvoiceId?: string; // Invoice ID for customer payments, PO ID for supplier payments
  date: string; // Formatted date string, e.g., "Jul 15, 2024"
  isoDate: string; // ISO date string for sorting and Firestore Timestamp storage
  amount: number;
  displayAmount: string; // Formatted currency string
  method: "Cash" | "UPI" | "Card" | "Bank Transfer" | "ACH" | "Check" | "Other";
  transactionId?: string;
  status: "Completed" | "Pending" | "Failed" | "Sent" | "Received"; // Added "Received" for customer payments
  notes?: string;
  createdAt?: Timestamp; // Firestore Timestamp
}

const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "ACH", "Check", "Other"] as const;
const PAYMENT_STATUSES = ["Completed", "Pending", "Failed", "Sent", "Received"] as const;
const PAYMENT_TYPES = ["customer", "supplier"] as const;

// Zod schema for payment record form validation
const paymentRecordSchema = z.object({
  type: z.enum(PAYMENT_TYPES, { required_error: "Payment type is required." }),
  relatedEntityName: z.string().min(1, "Entity name is required."),
  relatedEntityId: z.string().min(1, "Entity ID is required."), // Future: Could be a select dropdown from customers/sellers
  relatedInvoiceId: z.string().optional(),
  isoDate: z.string().refine((date) => !isNaN(parseISO(date).valueOf()), { message: "Invalid date" }),
  amount: z.preprocess(
    (val) => parseFloat(String(val).replace(/[^0-9.]+/g, "")),
    z.number({invalid_type_error: "Amount must be a number."}).positive({ message: "Amount must be positive." })
  ),
  method: z.enum(PAYMENT_METHODS, { required_error: "Payment method is required." }),
  transactionId: z.string().optional(),
  status: z.enum(PAYMENT_STATUSES, { required_error: "Status is required." }),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentRecordSchema>;

/**
 * Formats a number as an Indian Rupee string.
 * @param {number} num - The number to format.
 * @returns {string} A string representing the currency.
 */
const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;


/**
 * PaymentsPage component.
 * Provides UI for Admin to manage customer and supplier payment records from Firestore.
 * @returns {JSX.Element} The rendered payments page.
 */
export default function PaymentsPage() {
  const { toast } = useToast();
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentRecordSchema),
    defaultValues: { type: "customer", isoDate: new Date().toISOString().split('T')[0], status: "Completed", method: "Cash" },
  });

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "payments"), orderBy("isoDate", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedPayments = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        let paymentDate = "";
        if (data.isoDate) {
             if (typeof data.isoDate === 'string') {
                paymentDate = format(new Date(data.isoDate), "MMM dd, yyyy");
            } else if (data.isoDate instanceof Timestamp) { // Firestore Timestamp
                paymentDate = format(data.isoDate.toDate(), "MMM dd, yyyy");
            }
        }
        return { 
          id: docSnapshot.id,
          type: data.type || 'customer',
          relatedEntityName: data.relatedEntityName || 'N/A',
          relatedEntityId: data.relatedEntityId || '',
          relatedInvoiceId: data.relatedInvoiceId || '',
          date: paymentDate,
          isoDate: typeof data.isoDate === 'string' ? data.isoDate : (data.isoDate as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          amount: data.amount || 0,
          displayAmount: formatCurrency(data.amount || 0),
          method: data.method || 'Other',
          transactionId: data.transactionId || '',
          status: data.status || 'Pending',
          notes: data.notes || '',
          createdAt: data.createdAt,
        } as PaymentRecord;
      });
      setAllPayments(fetchedPayments);
    } catch (error) {
      console.error("Error fetching payments: ", error);
      toast({ title: "Error", description: "Could not load payment records from database.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    if (editingPayment && isFormDialogOpen) {
      form.reset({
        ...editingPayment,
        isoDate: editingPayment.isoDate ? editingPayment.isoDate.split('T')[0] : new Date().toISOString().split('T')[0], // Ensure date is in YYYY-MM-DD for input
      });
    } else {
      form.reset({ type: "customer", isoDate: new Date().toISOString().split('T')[0], status: "Completed", method: "Cash", relatedEntityName: "", relatedEntityId: "", relatedInvoiceId: "", amount: 0, transactionId: "", notes: "" });
    }
  }, [editingPayment, isFormDialogOpen, form]);


  const handleFormSubmit = async (values: PaymentFormValues) => {
    try {
      const dataToSave = {
        ...values,
        displayAmount: formatCurrency(values.amount),
        createdAt: serverTimestamp(),
      };

      if (editingPayment) {
        const paymentRef = doc(db, "payments", editingPayment.id);
        await updateDoc(paymentRef, dataToSave);
        toast({ title: "Payment Updated", description: "Payment record updated successfully in Firestore." });
      } else {
        await addDoc(collection(db, "payments"), dataToSave);
        toast({ title: "Payment Added", description: "New payment record added to Firestore." });
      }
      fetchPayments(); // Refresh list
      setIsFormDialogOpen(false);
      setEditingPayment(null);
    } catch (error) {
      console.error("Error saving payment: ", error);
      toast({ title: "Error", description: "Could not save payment record to database.", variant: "destructive" });
    }
  };

  const openAddDialog = () => {
    setEditingPayment(null);
    form.reset({ type: "customer", isoDate: new Date().toISOString().split('T')[0], status: "Completed", method: "Cash", relatedEntityName: "", relatedEntityId: "", relatedInvoiceId: "", amount: 0, transactionId: "", notes: "" });
    setIsFormDialogOpen(true);
  };
  
  const openEditDialog = (payment: PaymentRecord) => {
    setEditingPayment(payment);
    setIsFormDialogOpen(true);
  };
  
  const handleDeletePayment = async (paymentId: string) => {
    // Future: Implement soft delete or archiving.
    try {
        await deleteDoc(doc(db, "payments", paymentId));
        toast({ title: "Payment Deleted", description: "Payment record deleted successfully." });
        fetchPayments();
    } catch (error) {
        console.error("Error deleting payment: ", error);
        toast({ title: "Error", description: "Could not delete payment record.", variant: "destructive" });
    }
  };

  const getBadgeVariant = (status: PaymentRecord['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "Completed":
      case "Received":
        return "default"; // Green for success
      case "Pending":
      case "Sent":
        return "secondary"; // Neutral or slightly different
      case "Failed":
        return "destructive"; // Red for failure
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return <PageHeader title="Payment Records" description="Loading payment data from database..." icon={CreditCard} />;
  }

  const customerPayments = allPayments.filter(p => p.type === "customer");
  const supplierPayments = allPayments.filter(p => p.type === "supplier");

  const renderPaymentTable = (payments: PaymentRecord[], type: "customer" | "supplier") => (
    <Table>
      <TableHeader><TableRow>
          <TableHead>Date</TableHead>
          <TableHead>{type === "customer" ? "Customer" : "Supplier"}</TableHead>
          <TableHead>Ref/Invoice ID</TableHead>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-center">Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>{payment.date}</TableCell>
            <TableCell>{payment.relatedEntityName}</TableCell>
            <TableCell>{payment.relatedInvoiceId || payment.relatedEntityId}</TableCell>
            <TableCell>{payment.method}</TableCell>
            <TableCell className="text-right">{payment.displayAmount}</TableCell>
            <TableCell className="text-center">
              <Badge 
                variant={getBadgeVariant(payment.status)}
                className={ (payment.status === "Completed" || payment.status === "Received") ? "bg-accent text-accent-foreground" : 
                           (payment.status === "Pending" || payment.status === "Sent") ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300" : ""}
              >{payment.status}</Badge>
            </TableCell>
             <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Actions</span></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEditDialog(payment)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleDeletePayment(payment.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <>
      <PageHeader
        title="Payment Records"
        description="Track and manage customer and supplier payments. (Admin Access)"
        icon={CreditCard}
        actions={<Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Add Payment</Button>}
      />

      <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) { setIsFormDialogOpen(false); setEditingPayment(null); form.reset(); } else {setIsFormDialogOpen(isOpen); }}}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPayment ? "Edit Payment Record" : "Add New Payment Record"}</DialogTitle>
            <DialogDescription>Fill in the details for the payment.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem><FormLabel>Payment Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>{PAYMENT_TYPES.map(type => <SelectItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>)}
              />
              <FormField control={form.control} name="relatedEntityName" render={({ field }) => (<FormItem><FormLabel>{form.watch("type") === "customer" ? "Customer Name" : "Supplier Name"}</FormLabel><FormControl><Input placeholder="Enter name" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="relatedEntityId" render={({ field }) => (<FormItem><FormLabel>{form.watch("type") === "customer" ? "Customer ID" : "Supplier ID"}</FormLabel><FormControl><Input placeholder="Enter ID (e.g., CUST001)" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="relatedInvoiceId" render={({ field }) => (<FormItem><FormLabel>Related Invoice/PO ID (Optional)</FormLabel><FormControl><Input placeholder="e.g., INV001 or PO123" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="isoDate" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount (₹)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 1000.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="method" render={({ field }) => (
                <FormItem><FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger></FormControl>
                    <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>)}
              />
              <FormField control={form.control} name="transactionId" render={({ field }) => (<FormItem><FormLabel>Transaction ID (Optional)</FormLabel><FormControl><Input placeholder="e.g., Bank transaction ref" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem><FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                    <SelectContent>{PAYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>)}
              />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Any additional notes..." {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2">
                <DialogClose asChild><Button type="button" variant="outline" onClick={() => { setIsFormDialogOpen(false); setEditingPayment(null);}}>Cancel</Button></DialogClose>
                <Button type="submit">{editingPayment ? "Save Changes" : "Add Payment"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>


      <Tabs defaultValue="customer_payments" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-[400px] mb-4">
          <TabsTrigger value="customer_payments">Customer Payments</TabsTrigger>
          <TabsTrigger value="supplier_payments">Supplier Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="customer_payments">
          <Card className="shadow-lg rounded-xl">
            <CardHeader><CardTitle className="font-headline text-foreground">Customer Payment History</CardTitle><CardDescription>Records of payments received from customers.</CardDescription></CardHeader>
            <CardContent>{customerPayments.length > 0 ? renderPaymentTable(customerPayments, "customer") : (<div className="text-center py-8 text-muted-foreground">No customer payments recorded.</div>)}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="supplier_payments">
          <Card className="shadow-lg rounded-xl">
            <CardHeader><CardTitle className="font-headline text-foreground">Supplier Payment History</CardTitle><CardDescription>Records of payments made to suppliers.</CardDescription></CardHeader>
            <CardContent>{supplierPayments.length > 0 ? renderPaymentTable(supplierPayments, "supplier") : (<div className="text-center py-8 text-muted-foreground">No supplier payments recorded.</div>)}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
