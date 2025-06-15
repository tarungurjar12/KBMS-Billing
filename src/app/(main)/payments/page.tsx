
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { CreditCard, PlusCircle, MoreHorizontal, Edit, Trash2 } from "lucide-react"; // Removed Eye, it's not used
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
 * Data is fetched from and saved to Firebase Firestore.
 */

/**
 * Interface representing a Payment Record document in Firestore.
 */
export interface PaymentRecord {
  id: string; // Firestore document ID
  type: "customer" | "supplier"; // Type of payment: from customer or to supplier
  relatedEntityName: string; // Name of the customer or supplier
  relatedEntityId: string; // Firestore ID of the customer or supplier
  relatedInvoiceId?: string; // Optional: Invoice ID (for customer payments) or Purchase Order ID (for supplier payments)
  date: string; // Formatted date string for display, e.g., "Jul 15, 2024"
  isoDate: string; // ISO date string (YYYY-MM-DD) for sorting and Firestore Timestamp storage
  amount: number; // Numeric amount of the payment
  displayAmount: string; // Formatted currency string for display, e.g., "₹1,234.56"
  method: "Cash" | "UPI" | "Card" | "Bank Transfer" | "ACH" | "Check" | "Other"; // Payment method
  transactionId?: string; // Optional: Bank transaction ID, check number, etc.
  status: "Completed" | "Pending" | "Failed" | "Sent" | "Received"; // Status of the payment
  notes?: string; // Optional notes about the payment
  createdAt?: Timestamp; // Firestore Timestamp of when the record was created
}

// Constants for form select options
const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "ACH", "Check", "Other"] as const;
const PAYMENT_STATUSES = ["Completed", "Pending", "Failed", "Sent", "Received"] as const;
const PAYMENT_TYPES = ["customer", "supplier"] as const;

// Zod schema for payment record form validation
const paymentRecordSchema = z.object({
  type: z.enum(PAYMENT_TYPES, { required_error: "Payment type (Customer/Supplier) is required." }),
  relatedEntityName: z.string().min(1, "Entity name (Customer/Supplier Name) is required."),
  relatedEntityId: z.string().min(1, "Entity ID (Customer/Supplier ID) is required."), 
  relatedInvoiceId: z.string().optional(),
  isoDate: z.string().refine((date) => !isNaN(parseISO(date).valueOf()), { message: "A valid payment date is required." }),
  amount: z.preprocess(
    (val) => parseFloat(String(val).replace(/[^0-9.]+/g, "")), // Clean and parse amount
    z.number({invalid_type_error: "Amount must be a valid number."}).positive({ message: "Amount must be a positive value." })
  ),
  method: z.enum(PAYMENT_METHODS, { required_error: "Payment method is required." }),
  transactionId: z.string().optional(),
  status: z.enum(PAYMENT_STATUSES, { required_error: "Payment status is required." }),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentRecordSchema>;

/**
 * Formats a number as an Indian Rupee string.
 * @param {number} num - The number to format.
 * @returns {string} A string representing the currency, e.g., "₹1,234.56".
 */
const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;


/**
 * PaymentsPage component.
 * Provides UI for Admin to manage customer and supplier payment records using Firestore.
 * Handles CRUD operations for payment records.
 * @returns {JSX.Element} The rendered payments page.
 */
export default function PaymentsPage() {
  const { toast } = useToast();
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  
  // React Hook Form setup for the payment record form
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentRecordSchema),
    defaultValues: { 
      type: "customer", 
      isoDate: new Date().toISOString().split('T')[0], // Default to today
      status: "Completed", 
      method: "Cash",
      relatedEntityName: "",
      relatedEntityId: "",
      amount: 0, // Explicitly set default to 0
    },
  });

  /**
   * Fetches all payment records from Firestore, ordered by date (descending).
   * Transforms Firestore data into the PaymentRecord interface for UI display.
   */
  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "payments"), orderBy("isoDate", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedPayments = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        let paymentDate = "";
        // Handle both ISO string and Firestore Timestamp for isoDate field
        if (data.isoDate) {
             if (typeof data.isoDate === 'string') {
                paymentDate = format(parseISO(data.isoDate), "MMM dd, yyyy"); // Use parseISO for ISO strings
            } else if (data.isoDate instanceof Timestamp) { 
                paymentDate = format(data.isoDate.toDate(), "MMM dd, yyyy");
            }
        }
        return { 
          id: docSnapshot.id,
          type: data.type || 'customer', // Default to 'customer' if type is missing
          relatedEntityName: data.relatedEntityName || 'N/A',
          relatedEntityId: data.relatedEntityId || '',
          relatedInvoiceId: data.relatedInvoiceId || '',
          date: paymentDate,
          isoDate: typeof data.isoDate === 'string' ? data.isoDate : (data.isoDate instanceof Timestamp ? data.isoDate.toDate().toISOString().split('T')[0] : new Date().toISOString().split('T')[0]),
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
      toast({ title: "Database Error", description: "Could not load payment records. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch payments when the component mounts
  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Effect to reset form when editingPayment or dialog state changes
  useEffect(() => {
    if (editingPayment && isFormDialogOpen) {
      form.reset({
        ...editingPayment,
        // Ensure isoDate is in 'YYYY-MM-DD' format for the date input
        isoDate: editingPayment.isoDate ? editingPayment.isoDate.split('T')[0] : new Date().toISOString().split('T')[0], 
      });
    } else if (isFormDialogOpen && !editingPayment) { // Reset for add new dialog
      form.reset({ 
        type: "customer", 
        isoDate: new Date().toISOString().split('T')[0], 
        status: "Completed", 
        method: "Cash", 
        relatedEntityName: "", 
        relatedEntityId: "", 
        relatedInvoiceId: "", 
        amount: 0, 
        transactionId: "", 
        notes: "" 
      });
    }
  }, [editingPayment, isFormDialogOpen, form]);


  /**
   * Handles submission of the payment record form (for both add and edit).
   * Saves or updates the payment record in Firestore.
   * @param {PaymentFormValues} values - The validated form values.
   */
  const handleFormSubmit = async (values: PaymentFormValues) => {
    form.formState.isSubmitting; // Access isSubmitting to ensure its value is tracked
    try {
      const dataToSave = {
        ...values,
        displayAmount: formatCurrency(values.amount), // Store formatted amount
        // createdAt is handled by serverTimestamp on add, and preserved on edit
      };

      if (editingPayment) { // Update existing payment
        const paymentRef = doc(db, "payments", editingPayment.id);
        // Exclude createdAt from update to preserve original creation time
        const { createdAt, ...updateData } = dataToSave; 
        await updateDoc(paymentRef, {...updateData, updatedAt: serverTimestamp()}); // Add/update updatedAt
        toast({ title: "Payment Updated", description: "Payment record updated successfully in Firestore." });
      } else { // Add new payment
        await addDoc(collection(db, "payments"), {...dataToSave, createdAt: serverTimestamp()});
        toast({ title: "Payment Added", description: "New payment record added to Firestore." });
      }
      fetchPayments(); // Refresh the payment list
      setIsFormDialogOpen(false); // Close the dialog
      setEditingPayment(null); // Clear editing state
    } catch (error) {
      console.error("Error saving payment: ", error);
      toast({ title: "Save Error", description: "Could not save payment record to the database. Please try again.", variant: "destructive" });
    } finally {
      form.reset({}, { keepValues: false }); // Fully reset form state
    }
  };

  /**
   * Opens the dialog for adding a new payment record.
   */
  const openAddDialog = () => {
    setEditingPayment(null); // Ensure not in edit mode
    // Form reset is handled by useEffect when isFormDialogOpen becomes true and editingPayment is null
    setIsFormDialogOpen(true);
  };
  
  /**
   * Opens the dialog for editing an existing payment record and pre-fills the form.
   * @param {PaymentRecord} payment - The payment record to edit.
   */
  const openEditDialog = (payment: PaymentRecord) => {
    setEditingPayment(payment);
    // Form reset with payment data is handled by useEffect
    setIsFormDialogOpen(true);
  };
  
  /**
   * Deletes a payment record from Firestore.
   * @param {string} paymentId - The ID of the payment record to delete.
   */
  const handleDeletePayment = async (paymentId: string) => {
    // Future: Implement soft delete (archiving) instead of hard delete.
    // For now, a confirmation dialog could be added here for safety.
    try {
        await deleteDoc(doc(db, "payments", paymentId));
        toast({ title: "Payment Deleted", description: "Payment record deleted successfully." });
        fetchPayments(); // Refresh list
    } catch (error) {
        console.error("Error deleting payment: ", error);
        toast({ title: "Deletion Error", description: "Could not delete payment record. Please try again.", variant: "destructive" });
    }
  };

  /**
   * Determines the badge variant based on payment status for styling.
   * @param {PaymentRecord['status']} status - The status of the payment.
   * @returns {"default" | "secondary" | "destructive" | "outline"} The badge variant.
   */
  const getBadgeVariant = (status: PaymentRecord['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "Completed":
      case "Received":
        return "default"; // Typically green/accent
      case "Pending":
      case "Sent":
        return "secondary"; // Neutral or distinct color (e.g., blue)
      case "Failed":
        return "destructive"; // Red
      default:
        return "secondary";
    }
  };

  // Display loading state
  if (isLoading) {
    return <PageHeader title="Payment Records" description="Loading payment data from database..." icon={CreditCard} />;
  }

  // Filter payments into customer and supplier categories
  const customerPayments = allPayments.filter(p => p.type === "customer");
  const supplierPayments = allPayments.filter(p => p.type === "supplier");

  /**
   * Renders a table for displaying payment records.
   * @param {PaymentRecord[]} payments - Array of payment records to display.
   * @param {"customer" | "supplier"} type - The type of payments in the table.
   * @returns {JSX.Element} The rendered table.
   */
  const renderPaymentTable = (payments: PaymentRecord[], type: "customer" | "supplier") => (
    <Table>
      <TableHeader><TableRow>
          <TableHead>Date</TableHead>
          <TableHead>{type === "customer" ? "Customer" : "Supplier"} Name</TableHead>
          <TableHead>Ref/Invoice ID</TableHead>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Amount (₹)</TableHead>
          <TableHead className="text-center">Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>{payment.date}</TableCell>
            <TableCell>{payment.relatedEntityName}</TableCell>
            <TableCell>{payment.relatedInvoiceId || payment.transactionId || "N/A"}</TableCell>
            <TableCell>{payment.method}</TableCell>
            <TableCell className="text-right">{payment.displayAmount}</TableCell>
            <TableCell className="text-center">
              <Badge 
                variant={getBadgeVariant(payment.status)}
                // Custom styling for specific statuses to enhance visual distinction
                className={ 
                    (payment.status === "Completed" || payment.status === "Received") ? "bg-accent text-accent-foreground" : 
                    (payment.status === "Pending" || payment.status === "Sent") ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300 bg-transparent" : 
                    "" // 'destructive' variant handles 'Failed'
                }
              >{payment.status}</Badge>
            </TableCell>
             <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Actions for payment {payment.id}</span></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEditDialog(payment)}><Edit className="mr-2 h-4 w-4" /> Edit Record</DropdownMenuItem>
                  {/* Add confirmation for delete in future if needed */}
                  <DropdownMenuItem onClick={() => handleDeletePayment(payment.id)} className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Record
                  </DropdownMenuItem>
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
        description="Track and manage all customer and supplier payments. (Admin Access)"
        icon={CreditCard}
        actions={<Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Record New Payment</Button>}
      />

      {/* Dialog for Adding or Editing Payment Records */}
      <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { 
          if(!isOpen) { 
              setIsFormDialogOpen(false); 
              setEditingPayment(null); 
              form.reset(); // Ensure form is reset when dialog is closed
          } else {
              setIsFormDialogOpen(isOpen); 
          }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPayment ? "Edit Payment Record" : "Record New Payment"}</DialogTitle>
            <DialogDescription>
              {editingPayment ? `Update details for payment ID: ${editingPayment.id}` : "Fill in the details for the new payment record."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
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
              <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount (₹)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 1000.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select payment status" /></SelectTrigger></FormControl>
                    <SelectContent>{PAYMENT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>)}
              />
              <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Any additional notes about this payment..." {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 border-t"> {/* Added border-t */}
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (editingPayment ? "Saving Changes..." : "Adding Payment...") : (editingPayment ? "Save Changes" : "Add Payment Record")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Tabs for Customer and Supplier Payments */}
      <Tabs defaultValue="customer_payments" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 sm:w-[400px] mb-4">
          <TabsTrigger value="customer_payments">Customer Payments (Received)</TabsTrigger>
          <TabsTrigger value="supplier_payments">Supplier Payments (Made)</TabsTrigger>
        </TabsList>
        <TabsContent value="customer_payments">
          <Card className="shadow-lg rounded-xl">
            <CardHeader><CardTitle className="font-headline text-foreground">Customer Payment History</CardTitle><CardDescription>Records of payments received from customers.</CardDescription></CardHeader>
            <CardContent>{customerPayments.length > 0 ? renderPaymentTable(customerPayments, "customer") : (<div className="text-center py-8 text-muted-foreground">No customer payments recorded yet.</div>)}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="supplier_payments">
          <Card className="shadow-lg rounded-xl">
            <CardHeader><CardTitle className="font-headline text-foreground">Supplier Payment History</CardTitle><CardDescription>Records of payments made to suppliers/vendors.</CardDescription></CardHeader>
            <CardContent>{supplierPayments.length > 0 ? renderPaymentTable(supplierPayments, "supplier") : (<div className="text-center py-8 text-muted-foreground">No supplier payments recorded yet.</div>)}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

