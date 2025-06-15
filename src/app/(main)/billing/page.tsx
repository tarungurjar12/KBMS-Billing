
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { FileText, PlusCircle, MoreHorizontal, Download, Printer, Edit, Eye, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import { format } from 'date-fns';

/**
 * @fileOverview Page for Admin to manage Billing and Invoicing.
 * Allows Admin to:
 *  - View a list of all generated invoices from Firestore.
 *  - Navigate to create new invoices.
 *  - Perform actions like view, download (placeholder), print (placeholder), edit, 
 *    update status, and delete individual invoices.
 * Data is fetched from and saved to Firebase Firestore.
 */

/**
 * Interface for individual items within an invoice.
 */
export interface InvoiceItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unitOfMeasure: string;
}

/**
 * Interface representing an invoice document stored in Firestore.
 */
export interface Invoice {
  id: string; // Firestore document ID
  invoiceNumber: string;
  customerName: string;
  customerId: string;
  date: string; // Formatted date string for display, e.g., "Jul 15, 2024"
  isoDate: string; // ISO date string for sorting and consistent Firestore Timestamp storage
  totalAmount: number; // The grand total of the invoice
  displayTotal: string; // Formatted currency string for display, e.g., "₹20,000.00"
  status: "Paid" | "Pending" | "Overdue" | "Partially Paid" | "Cancelled";
  items: InvoiceItem[];
  cgst: number;
  sgst: number;
  igst: number;
  subTotal: number;
  createdBy?: string; // UID of the user who created the invoice
  createdAt?: Timestamp; // Firestore Timestamp of creation
  dueDate?: string; // Optional ISO date string for due date
}

/**
 * Formats a number as an Indian Rupee string.
 * @param {number} num - The number to format.
 * @returns {string} A string representing the currency, e.g., "₹1,234.56".
 */
const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;


/**
 * BillingPage component.
 * Provides UI and logic for Admin to manage bills and invoices using Firestore.
 * @returns {JSX.Element} The rendered billing page.
 */
export default function BillingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fetches invoices from Firestore, ordered by date (descending).
   * Transforms Firestore data into the Invoice interface for UI display.
   */
  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "invoices"), orderBy("isoDate", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedInvoices = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        let invoiceDate = "";
        // Handle both ISO string and Firestore Timestamp for isoDate field
        if (data.isoDate) {
            if (typeof data.isoDate === 'string') {
                invoiceDate = format(new Date(data.isoDate), "MMM dd, yyyy");
            } else if (data.isoDate instanceof Timestamp) {
                invoiceDate = format(data.isoDate.toDate(), "MMM dd, yyyy");
            }
        }

        return {
          id: docSnapshot.id,
          invoiceNumber: data.invoiceNumber || 'N/A',
          customerName: data.customerName || 'N/A',
          customerId: data.customerId || '',
          date: invoiceDate,
          isoDate: typeof data.isoDate === 'string' ? data.isoDate : (data.isoDate as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
          totalAmount: data.totalAmount || data.grandTotal || 0, // Prioritize totalAmount, fallback to grandTotal for compatibility
          displayTotal: formatCurrency(data.totalAmount || data.grandTotal || 0),
          status: data.status || 'Pending',
          items: data.items || [],
          cgst: data.cgst || 0,
          sgst: data.sgst || 0,
          igst: data.igst || 0,
          subTotal: data.subTotal || 0,
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          dueDate: data.dueDate,
        } as Invoice;
      });
      setInvoices(fetchedInvoices);
    } catch (error) {
      console.error("Error fetching invoices: ", error);
      toast({ title: "Database Error", description: "Could not load invoices. Please try again later.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  /**
   * Navigates to the page for creating new bills/invoices.
   */
  const handleCreateNewInvoice = () => {
    router.push("/create-bill");
  };

  /**
   * Handles viewing an invoice. (Placeholder for detailed view)
   * @param {string} invoiceId - The ID of the invoice to view.
   */
  const handleViewInvoice = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    toast({ 
        title: `View Invoice (Placeholder): ${invoice?.invoiceNumber || invoiceId}`, 
        description: `Customer: ${invoice?.customerName}, Total: ${invoice?.displayTotal}. Detailed view to be implemented.` 
    });
    // Future: Implement a detailed view page or modal for the invoice
    // router.push(`/billing/${invoiceId}`);
  };

  /**
   * Handles downloading an invoice PDF. (Placeholder)
   * @param {string} invoiceId - The ID of the invoice to download.
   */
  const handleDownloadPDF = (invoiceId: string) => {
    toast({ title: "Download PDF (Placeholder)", description: `Downloading PDF for invoice ID: ${invoiceId}. PDF generation to be implemented.` });
    // Future: Implement PDF generation (e.g., using jsPDF or a backend service) and download.
  };
  
  /**
   * Handles printing an invoice. (Placeholder)
   * @param {string} invoiceId - The ID of the invoice to print.
   */
  const handlePrintInvoice = (invoiceId: string) => {
    toast({ title: "Print Invoice (Placeholder)", description: `Printing invoice ID: ${invoiceId}. Print-friendly view/logic to be implemented.` });
    // Future: Implement print functionality, possibly opening window.print() on a formatted page.
  };

  /**
   * Navigates to the edit invoice page.
   * @param {string} invoiceId - The ID of the invoice to edit.
   */
  const handleEditInvoice = (invoiceId: string) => {
    router.push(`/create-bill?editInvoiceId=${invoiceId}`); // Pass invoice ID as query param
  };
  
  /**
   * Updates the status of an invoice in Firestore.
   * @param {string} invoiceId - The ID of the invoice to update.
   * @param {Invoice['status']} newStatus - The new status to set.
   */
  const handleUpdateStatus = async (invoiceId: string, newStatus: Invoice['status']) => {
    try {
      const invoiceRef = doc(db, "invoices", invoiceId);
      await updateDoc(invoiceRef, { status: newStatus });
      toast({ title: "Status Updated", description: `Invoice status changed to ${newStatus}.` });
      fetchInvoices(); // Refresh the list to show the updated status
    } catch (error) {
      console.error("Error updating invoice status: ", error);
      toast({ title: "Update Error", description: "Could not update invoice status. Please try again.", variant: "destructive" });
    }
  };

  /**
   * Deletes an invoice from Firestore.
   * @param {string} invoiceId - The ID of the invoice to delete.
   * @param {string} invoiceNumber - The number of the invoice, for display in toast.
   */
  const handleDeleteInvoice = async (invoiceId: string, invoiceNumber: string) => {
    // Future: Implement soft delete (archiving) instead of hard delete for auditing.
    try {
      await deleteDoc(doc(db, "invoices", invoiceId));
      toast({ title: "Invoice Deleted", description: `Invoice ${invoiceNumber} has been successfully deleted.`, variant: "default" });
      fetchInvoices(); // Refresh the list
    } catch (error) {
      console.error("Error deleting invoice: ", error);
      toast({ title: "Deletion Error", description: "Could not delete invoice. Please try again.", variant: "destructive" });
    }
  };
  
  /**
   * Determines the badge variant based on invoice status for styling.
   * @param {Invoice['status']} status - The status of the invoice.
   * @returns {"default" | "secondary" | "destructive" | "outline"} The badge variant.
   */
  const getBadgeVariant = (status: Invoice['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "Paid":
        return "default"; // Uses accent color for 'Paid' as defined in Badge component variants
      case "Pending":
        return "secondary";
      case "Overdue":
        return "destructive";
      case "Partially Paid":
        return "outline"; // Uses outline variant, can be styled further with custom classes
      case "Cancelled":
        return "destructive"; // Similar to overdue or a distinct gray
      default:
        return "secondary";
    }
  };

  // Display loading state
  if (isLoading) {
    return <PageHeader title="Billing & Invoicing" description="Loading invoices from database..." icon={FileText} />;
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
          <CardDescription>A list of all generated invoices, fetched from Firestore. Most recent first.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
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
                        // Custom styling for specific statuses on top of variant
                        className={
                            invoice.status === "Paid" ? "bg-accent text-accent-foreground" : 
                            invoice.status === "Partially Paid" ? "border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-300" :
                            invoice.status === "Cancelled" ? "bg-muted text-muted-foreground border-muted-foreground/30" : ""
                        }
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
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleEditInvoice(invoice.id)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Invoice
                        </DropdownMenuItem>
                        {/* Simplified status updates directly in menu for demo purposes */}
                        {invoice.status !== "Paid" && <DropdownMenuItem onClick={() => handleUpdateStatus(invoice.id, "Paid")}>Mark as Paid</DropdownMenuItem>}
                        {invoice.status !== "Pending" && <DropdownMenuItem onClick={() => handleUpdateStatus(invoice.id, "Pending")}>Mark as Pending</DropdownMenuItem>}
                        {invoice.status !== "Overdue" && <DropdownMenuItem onClick={() => handleUpdateStatus(invoice.id, "Overdue")}>Mark as Overdue</DropdownMenuItem>}
                        {invoice.status !== "Cancelled" && <DropdownMenuItem onClick={() => handleUpdateStatus(invoice.id, "Cancelled")}>Mark as Cancelled</DropdownMenuItem>}
                        <DropdownMenuSeparator />
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
                No invoices found in the database.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

