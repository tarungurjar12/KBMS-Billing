
"use client"; // This page will involve client-side interactions

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { CreditCard, PlusCircle, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react"; // Added Edit, Trash2, Eye
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
// Future: Import Firebase functions for Firestore operations
// import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, addDoc } from 'firebase/firestore';
// import { db } from '@/lib/firebase/firebaseConfig';

/**
 * @fileOverview Page for Admin to manage Payment Records.
 * Allows Admin to:
 *  - Track and manage payment status for both customer and supplier payments.
 *  - Manually record payments (customer incoming, supplier outgoing).
 *  - View payment history.
 * Store Managers can update customer payment status (via Customer or Billing page interactions, not directly here).
 * Supplier payments are strictly Admin-only.
 */

interface PaymentRecord {
  id: string; // Firestore document ID or unique local ID
  type: "customer" | "supplier";
  relatedId: string; // Invoice ID for customer, Supplier ID or Purchase Order ID for supplier
  date: string; // Formatted date string
  isoDate: string; // ISO date string for sorting
  amount: number;
  displayAmount: string;
  method: "Cash" | "UPI" | "Card" | "Bank Transfer" | "ACH" | "Check" | "Other";
  transactionId?: string; // Optional reference for UPI, Card, etc.
  status: "Completed" | "Pending" | "Failed" | "Sent"; // Added "Failed", "Sent"
  notes?: string;
  // For customer payments, could link to customerId. For supplier, could link to supplierName.
  customerName?: string; // Denormalized for customer payments
  supplierName?: string; // Denormalized for supplier payments
}

// Initial dummy data. This will be replaced by Firestore data in Phase 2.
const initialPayments: PaymentRecord[] = [
  { id: "PAY-CUST-001", type: "customer", relatedId: "INV001", customerName: "Alice Wonderland", date: "2024-07-15", isoDate: "2024-07-15T00:00:00Z", amount: 20000, displayAmount: "₹20,000.00", method: "Card", transactionId: "TXN789012", status: "Completed" },
  { id: "PAY-CUST-002", type: "customer", relatedId: "INV002", customerName: "Bob The Builder", date: "2024-07-19", isoDate: "2024-07-19T00:00:00Z", amount: 12060, displayAmount: "₹12,060.00", method: "Bank Transfer", status: "Pending" },
  { id: "PAY-SUPP-001", type: "supplier", relatedId: "SUPP001", supplierName: "Widget Co.", date: "2024-07-10", isoDate: "2024-07-10T00:00:00Z", amount: 40000, displayAmount: "₹40,000.00", method: "ACH", status: "Completed" },
  { id: "PAY-SUPP-002", type: "supplier", relatedId: "SUPP002", supplierName: "Gizmo Inc.", date: "2024-07-21", isoDate: "2024-07-21T00:00:00Z", amount: 25600, displayAmount: "₹25,600.00", method: "Check", status: "Sent", notes: "Check #12345" },
];

/**
 * PaymentsPage component.
 * Provides UI for Admin to manage customer and supplier payment records.
 */
export default function PaymentsPage() {
  const { toast } = useToast();
  const [allPayments, setAllPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Future: Add state for filtering, sorting, pagination, and dialogs for adding/editing payments.

  // Effect to load payments (currently from initial data, future from Firestore)
  useEffect(() => {
    // Future: Fetch payments from Firestore, ordered by date
    // const fetchPayments = async () => {
    //   setIsLoading(true);
    //   try {
    //     const q = query(collection(db, "payments"), orderBy("isoDate", "desc"));
    //     const querySnapshot = await getDocs(q);
    //     const fetchedPayments = querySnapshot.docs.map(doc => {
    //       const data = doc.data();
    //       return { 
    //         id: doc.id,
    //         ...data,
    //         date: data.date instanceof Timestamp ? data.date.toDate().toLocaleDateString('en-CA') : data.date,
    //         displayAmount: `₹${Number(data.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    //       } as PaymentRecord;
    //     });
    //     setAllPayments(fetchedPayments);
    //   } catch (error) {
    //     console.error("Error fetching payments: ", error);
    //     toast({ title: "Error", description: "Could not load payment records.", variant: "destructive" });
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    // fetchPayments();

    // Phase 1: Use local data, sort by isoDate descending
    const sortedInitialPayments = [...initialPayments].sort((a,b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());
    setAllPayments(sortedInitialPayments);
    setIsLoading(false);
  }, [toast]);

  const customerPayments = allPayments.filter(p => p.type === "customer");
  const supplierPayments = allPayments.filter(p => p.type === "supplier");

  const handleAddPaymentRecord = () => {
    // Future: Open a dialog to choose payment type (customer/supplier) and fill details.
    toast({ title: "Add Payment (Placeholder)", description: "Functionality to add new payment records to be implemented."});
  };

  const handleViewPaymentDetails = (paymentId: string) => {
    toast({ title: "View Details (Placeholder)", description: `Viewing details for payment ID: ${paymentId}. To be implemented.` });
  };
  
  const handleEditPayment = (paymentId: string) => {
    toast({ title: "Edit Payment (Placeholder)", description: `Editing payment record ID: ${paymentId}. To be implemented.` });
  };
  
  const handleDeletePayment = (paymentId: string) => {
    // Future: Implement proper delete confirmation.
    toast({ title: "Delete Payment (Placeholder)", description: `Deleting payment record ID: ${paymentId}. Needs confirmation.`, variant: "destructive" });
    // Phase 1 local example:
    // setAllPayments(prev => prev.filter(p => p.id !== paymentId));
  };

  const getBadgeVariant = (status: PaymentRecord['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "Completed":
        return "default"; // Will use accent color defined in Badge component
      case "Pending":
        return "secondary";
      case "Failed":
        return "destructive";
      case "Sent":
         return "outline";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return <PageHeader title="Payment Records" description="Loading payment data..." icon={CreditCard} />;
  }

  const renderPaymentTable = (payments: PaymentRecord[], type: "customer" | "supplier") => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Payment ID</TableHead>
          <TableHead>{type === "customer" ? "Invoice ID" : "Supplier/Ref ID"}</TableHead>
          <TableHead>{type === "customer" ? "Customer" : "Supplier"}</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Method</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-center">Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell className="font-medium">{payment.id.split('-').pop()}</TableCell> {/* Shorten display ID */}
            <TableCell>{payment.relatedId}</TableCell>
            <TableCell>{type === "customer" ? payment.customerName : payment.supplierName}</TableCell>
            <TableCell>{payment.date}</TableCell>
            <TableCell>{payment.method}</TableCell>
            <TableCell className="text-right">{payment.displayAmount}</TableCell>
            <TableCell className="text-center">
              <Badge 
                variant={getBadgeVariant(payment.status)}
                className={payment.status === "Completed" ? "bg-accent text-accent-foreground" : 
                           payment.status === "Sent" ? "border-blue-500 text-blue-600" : ""}
              >
                {payment.status}
              </Badge>
            </TableCell>
             <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions for payment {payment.id}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleViewPaymentDetails(payment.id)}>
                    <Eye className="mr-2 h-4 w-4" /> View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleEditPayment(payment.id)}>
                    <Edit className="mr-2 h-4 w-4" /> Edit Record
                  </DropdownMenuItem>
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
        description="Track and manage customer and supplier payments. (Admin Access)"
        icon={CreditCard}
        actions={
          <Button onClick={handleAddPaymentRecord}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Payment Record
          </Button>
        }
      />
      <Tabs defaultValue="customer_payments" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-[400px] mb-4">
          <TabsTrigger value="customer_payments">Customer Payments</TabsTrigger>
          <TabsTrigger value="supplier_payments">Supplier Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="customer_payments">
          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-foreground">Customer Payment History</CardTitle>
              <CardDescription>Records of payments received from customers.</CardDescription>
            </CardHeader>
            <CardContent>
              {customerPayments.length > 0 ? renderPaymentTable(customerPayments, "customer") : (
                <div className="text-center py-8 text-muted-foreground">No customer payments found.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="supplier_payments">
          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-foreground">Supplier Payment History</CardTitle>
              <CardDescription>Records of payments made to suppliers.</CardDescription>
            </CardHeader>
            <CardContent>
              {supplierPayments.length > 0 ? renderPaymentTable(supplierPayments, "supplier") : (
                <div className="text-center py-8 text-muted-foreground">No supplier payments found.</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* 
        Phase 1 Data Storage: Payment data is stored in local component state.
        Phase 2 (Future-Ready):
        - Payments will be stored in a 'payments' collection in Firebase Firestore.
        - Fields would include: type ('customer' or 'supplier'), relatedId (invoiceId or supplierId/POId), date (Timestamp), isoDate (string),
          amount, method, transactionId, status, notes, createdBy, createdAt.
        - For customer payments, this could also update the status of the linked invoice in the 'invoices' collection.
        - Firestore Security Rules would ensure only Admins can create/edit supplier payments, while Admins and potentially Managers (for customer payments) can manage customer payment records.
      */}
    </>
  );
}
