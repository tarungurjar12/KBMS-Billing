
"use client"; // This page will involve client-side interactions for creating/managing bills

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { FileText, PlusCircle, MoreHorizontal, Download, Printer, Edit } from "lucide-react"; // Added Download, Printer, Edit
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
// Future: Import Firebase functions for Firestore operations
// import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
// import { db } from '@/lib/firebase/firebaseConfig';

/**
 * @fileOverview Page for Admin to manage Billing and Invoicing.
 * Allows Admin to:
 *  - View a list of all generated invoices.
 *  - Create new invoices (navigates to a dedicated create bill page).
 *  - View, download, print, edit, and delete individual invoices.
 *  - Update payment status of invoices.
 */

interface Invoice {
  id: string; // Firestore document ID or unique local ID
  invoiceNumber: string; // Displayed invoice number, e.g., INV001
  customerName: string; // Denormalized for display
  customerId: string; // Link to customer document
  date: string; // Formatted date string, e.g., "2024-07-15"
  isoDate: string; // ISO date string for sorting
  totalAmount: number; // Numeric total for calculations
  displayTotal: string; // Formatted currency string, e.g., "₹20,000.00"
  status: "Paid" | "Pending" | "Overdue" | "Partially Paid"; // Added "Partially Paid"
  // Future: items (array of bill items), taxDetails, notes, createdBy (managerId), dueDate
}

// Initial dummy data. This will be replaced by Firestore data in Phase 2.
const initialInvoices: Invoice[] = [
  { id: "BILL-LOCAL-001", invoiceNumber: "INV001", customerName: "Alice Wonderland", customerId: "CUST-LOCAL-001", date: "2024-07-15", isoDate: "2024-07-15T00:00:00Z", totalAmount: 20000, displayTotal: "₹20,000.00", status: "Paid" },
  { id: "BILL-LOCAL-002", invoiceNumber: "INV002", customerName: "Bob The Builder", customerId: "CUST-LOCAL-002", date: "2024-07-18", isoDate: "2024-07-18T00:00:00Z", totalAmount: 12060, displayTotal: "₹12,060.00", status: "Pending" },
  { id: "BILL-LOCAL-003", invoiceNumber: "INV003", customerName: "Charlie Chaplin", customerId: "CUST-LOCAL-003", date: "2024-07-20", isoDate: "2024-07-20T00:00:00Z", totalAmount: 40040, displayTotal: "₹40,040.00", status: "Overdue" },
  { id: "BILL-LOCAL-004", invoiceNumber: "INV004", customerName: "Diana Prince", customerId: "CUST-LOCAL-004", date: "2024-07-22", isoDate: "2024-07-22T00:00:00Z", totalAmount: 6000, displayTotal: "₹6,000.00", status: "Paid" },
  { id: "BILL-LOCAL-005", invoiceNumber: "INV005", customerName: "Alice Wonderland", customerId: "CUST-LOCAL-001", date: "2024-07-25", isoDate: "2024-07-25T00:00:00Z", totalAmount: 15000, displayTotal: "₹15,000.00", status: "Partially Paid" },
];


/**
 * BillingPage component.
 * Provides UI and logic for Admin to manage bills and invoices.
 */
export default function BillingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Future: Add state for filtering, sorting, pagination

  // Effect to load invoices (currently from initial data, future from Firestore)
  useEffect(() => {
    // Future: Fetch invoices from Firestore, ordered by date
    // const fetchInvoices = async () => {
    //   setIsLoading(true);
    //   try {
    //     const q = query(collection(db, "invoices"), orderBy("isoDate", "desc")); // or 'date' if stored as Timestamp
    //     const querySnapshot = await getDocs(q);
    //     const fetchedInvoices = querySnapshot.docs.map(doc => {
    //       const data = doc.data();
    //       return { 
    //         id: doc.id,
    //         ...data,
    //         // Ensure date is formatted if stored as Timestamp, and displayTotal is correct
    //         date: data.date instanceof Timestamp ? data.date.toDate().toLocaleDateString('en-CA') : data.date,
    //         displayTotal: `₹${Number(data.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    //       } as Invoice;
    //     });
    //     setInvoices(fetchedInvoices);
    //   } catch (error) {
    //     console.error("Error fetching invoices: ", error);
    //     toast({ title: "Error", description: "Could not load invoices.", variant: "destructive" });
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    // fetchInvoices();

    // Phase 1: Use local data, sort by isoDate descending
    const sortedInitialInvoices = [...initialInvoices].sort((a, b) => new Date(b.isoDate).getTime() - new Date(a.isoDate).getTime());
    setInvoices(sortedInitialInvoices);
    setIsLoading(false);
  }, [toast]);

  const handleCreateNewInvoice = () => {
    // Navigate to the dedicated page for creating bills/invoices
    // This page is also accessible by Store Managers
    router.push("/create-bill");
  };

  /** Placeholder functions for invoice actions */
  const handleViewInvoice = (invoiceId: string) => {
    toast({ title: "View Invoice (Placeholder)", description: `Viewing details for invoice ID: ${invoiceId}. To be implemented.` });
    // Future: router.push(`/billing/${invoiceId}`);
  };

  const handleDownloadPDF = (invoiceId: string) => {
    toast({ title: "Download PDF (Placeholder)", description: `Downloading PDF for invoice ID: ${invoiceId}. To be implemented.` });
    // Future: Implement PDF generation and download logic.
  };
  
  const handlePrintInvoice = (invoiceId: string) => {
    toast({ title: "Print Invoice (Placeholder)", description: `Printing invoice ID: ${invoiceId}. To be implemented.` });
    // Future: Implement print functionality, possibly opening a print-friendly view.
  };

  const handleEditInvoice = (invoiceId: string) => {
    toast({ title: "Edit Invoice (Placeholder)", description: `Editing invoice ID: ${invoiceId}. This is complex and needs careful consideration (e.g., impact on stock, accounting).` });
    // Future: Navigate to an edit page or open a modal. Consider restrictions on what can be edited after an invoice is finalized.
  };
  
  const handleUpdateStatus = (invoiceId: string, currentStatus: Invoice['status']) => {
    // This would typically open a dialog to select the new status and add payment details if applicable.
    // For simplicity, this placeholder just shows a toast.
    toast({ title: "Update Status (Placeholder)", description: `Functionality to update status for invoice ID: ${invoiceId} (current: ${currentStatus}) to be implemented. See Payment Management module.` });
    // Future: Update status in Firestore and potentially link to a payment record.
  };

  const handleDeleteInvoice = (invoiceId: string, invoiceNumber: string) => {
     // Future: Implement proper delete confirmation and logic.
     // Consider if invoices should be soft-deleted or archived instead of hard delete for auditing.
    toast({ title: "Delete Invoice (Placeholder)", description: `Deleting invoice ${invoiceNumber} (ID: ${invoiceId}). Needs confirmation and careful implementation.`, variant: "destructive" });
    // Phase 1: Local delete example
    // setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
  };
  
  const getBadgeVariant = (status: Invoice['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "Paid":
        return "default"; // Will use accent color defined in Badge component
      case "Pending":
        return "secondary";
      case "Overdue":
        return "destructive";
      case "Partially Paid":
        return "outline"; // Or another distinct style
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return <PageHeader title="Billing & Invoicing" description="Loading invoice data..." icon={FileText} />;
  }

  return (
    <>
      <PageHeader
        title="Billing & Invoicing"
        description="Create and manage GST-compliant bills and invoices. (Admin Access)"
        icon={FileText}
        actions={
          <Button onClick={handleCreateNewInvoice}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create New Invoice
          </Button>
        }
      />
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Invoice List</CardTitle>
          <CardDescription>A list of all generated invoices. Most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{invoice.customerName}</TableCell>
                  <TableCell>{invoice.date}</TableCell>
                  <TableCell className="text-right">{invoice.displayTotal}</TableCell>
                  <TableCell className="text-center">
                    <Badge 
                        variant={getBadgeVariant(invoice.status)}
                        className={invoice.status === "Paid" ? "bg-accent text-accent-foreground" : 
                                   invoice.status === "Partially Paid" ? "border-yellow-500 text-yellow-600" : ""}
                    >
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                     <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                           <span className="sr-only">Actions for {invoice.invoiceNumber}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewInvoice(invoice.id)}>
                            <Eye className="mr-2 h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadPDF(invoice.id)}>
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                        </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => handlePrintInvoice(invoice.id)}>
                            <Printer className="mr-2 h-4 w-4" /> Print Invoice
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUpdateStatus(invoice.id, invoice.status)}>
                            <Edit className="mr-2 h-4 w-4" /> Update Status
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                         <DropdownMenuItem onClick={() => handleEditInvoice(invoice.id)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Invoice (Caution)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteInvoice(invoice.id, invoice.invoiceNumber)} className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Invoice
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {invoices.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
                No invoices found.
            </div>
          )}
        </CardContent>
      </Card>
      {/* 
        Phase 1 Data Storage: Invoice data is stored in local component state.
        Phase 2 (Future-Ready):
        - Invoices will be stored in an 'invoices' collection in Firebase Firestore.
        - Fields would include: invoiceNumber (can be auto-generated), customerId, customerName (denormalized), date (Timestamp), isoDate (string for querying), 
          items (array of objects: {productId, productName, quantity, unitPrice, totalPrice}), 
          subTotal, cgst, sgst, igst, grandTotal, status, createdBy (managerAuthUid), createdAt, dueDate, paymentRecords (array of payment details or link to separate payments collection).
        - Creating an invoice would add a new document to this collection.
        - Stock levels in the 'products' collection would be updated (ideally in a transaction) upon invoice creation.
        - Payment status updates would modify the 'status' field and potentially add to 'paymentRecords'.
      */}
    </>
  );
}
