
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { FileText, PlusCircle, MoreHorizontal, Download, Printer, Edit, Eye, Trash2, AlertCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import { format, parseISO } from 'date-fns';

/**
 * @fileOverview Page for Admin to manage Billing and Invoicing.
 * Allows Admin to:
 *  - View a list of all generated invoices from Firestore.
 *  - Navigate to create new invoices.
 *  - Perform actions like view (placeholder), download (placeholder), print (placeholder), edit, 
 *    update status, and delete individual invoices.
 * Data is fetched from and saved to Firebase Firestore.
 */

export interface InvoiceItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unitOfMeasure: string;
}

export interface Invoice {
  id: string; 
  invoiceNumber: string;
  customerName: string;
  customerId: string;
  date: string; 
  isoDate: string; 
  totalAmount: number; 
  displayTotal: string; 
  status: "Paid" | "Pending" | "Overdue" | "Partially Paid" | "Cancelled";
  items: InvoiceItem[];
  cgst: number;
  sgst: number;
  igst: number;
  subTotal: number;
  createdBy?: string; 
  createdAt?: Timestamp; 
  dueDate?: string; 
  updatedAt?: Timestamp; 
}

const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function BillingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "invoices"), orderBy("isoDate", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedInvoices = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        let invoiceDate = "Date N/A";
        let finalIsoDate = new Date().toISOString(); 

        if (data.isoDate) {
            if (typeof data.isoDate === 'string') {
                 try {
                    invoiceDate = format(parseISO(data.isoDate), "MMM dd, yyyy"); 
                    finalIsoDate = data.isoDate;
                } catch (e) {
                    console.warn("Invalid isoDate string format:", data.isoDate, e);
                    invoiceDate = "Invalid Date";
                    if (data.createdAt instanceof Timestamp) finalIsoDate = data.createdAt.toDate().toISOString();
                }
            } else if (data.isoDate instanceof Timestamp) {
                invoiceDate = format(data.isoDate.toDate(), "MMM dd, yyyy");
                finalIsoDate = data.isoDate.toDate().toISOString();
            } else {
                 invoiceDate = "Unknown Date"; 
                 if (data.createdAt instanceof Timestamp) finalIsoDate = data.createdAt.toDate().toISOString();
            }
        } else if (data.createdAt instanceof Timestamp) { 
            invoiceDate = format(data.createdAt.toDate(), "MMM dd, yyyy");
            finalIsoDate = data.createdAt.toDate().toISOString();
        }

        return {
          id: docSnapshot.id,
          invoiceNumber: data.invoiceNumber || 'N/A',
          customerName: data.customerName || 'N/A',
          customerId: data.customerId || '',
          date: invoiceDate,
          isoDate: finalIsoDate,
          totalAmount: data.totalAmount || data.grandTotal || 0, 
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
          updatedAt: data.updatedAt,
        } as Invoice;
      });
      setInvoices(fetchedInvoices);
    } catch (error: any) {
      console.error("Error fetching invoices: ", error);
      if (error.code === 'failed-precondition') {
        toast({
            title: "Database Index Required",
            description: `A query for invoices failed. Please create the required Firestore index for 'invoices' collection (orderBy 'isoDate' descending). Check your browser's developer console for a Firebase link to create it, or visit the Firestore indexes page in your Firebase console.`,
            variant: "destructive",
            duration: 15000, 
        });
      } else {
        toast({ title: "Database Error", description: `Could not load invoices: ${error.message}`, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleCreateNewInvoice = () => {
    router.push("/create-bill");
  };

  const handleViewInvoice = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    toast({ 
        title: `View Invoice (Placeholder): ${invoice?.invoiceNumber || invoiceId}`, 
        description: `Detailed view for Customer: ${invoice?.customerName}, Total: ${invoice?.displayTotal} is planned for future implementation.` 
    });
  };

  const handleDownloadPDF = (invoiceId: string) => {
    toast({ title: "Download PDF (Placeholder)", description: `PDF generation for invoice ID: ${invoiceId} is a planned feature.` });
  };
  
  const handlePrintInvoice = (invoiceId: string) => {
    toast({ title: "Print Invoice (Placeholder)", description: `Print-friendly view/logic for invoice ID: ${invoiceId} to be implemented.` });
  };

  const handleEditInvoice = (invoiceId: string) => {
    router.push(`/create-bill?editInvoiceId=${invoiceId}`); 
  };
  
  const handleUpdateStatus = async (invoiceId: string, newStatus: Invoice['status']) => {
    try {
      const invoiceRef = doc(db, "invoices", invoiceId);
      await updateDoc(invoiceRef, { status: newStatus, updatedAt: serverTimestamp() });
      toast({ title: "Status Updated", description: `Invoice status changed to ${newStatus}.` });
      fetchInvoices(); 
    } catch (error: any) {
      console.error("Error updating invoice status: ", error);
      toast({ title: "Update Error", description: `Could not update invoice status: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeleteInvoice = async (invoiceId: string, invoiceNumber: string) => {
    try {
      await deleteDoc(doc(db, "invoices", invoiceId));
      toast({ title: "Invoice Deleted", description: `Invoice ${invoiceNumber} has been successfully deleted.`, variant: "default" });
      fetchInvoices(); 
    } catch (error: any) {
      console.error("Error deleting invoice: ", error);
      toast({ title: "Deletion Error", description: `Could not delete invoice: ${error.message}`, variant: "destructive" });
    }
  };
  
  const getBadgeVariant = (status: Invoice['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "Paid":
        return "default"; 
      case "Pending":
        return "secondary";
      case "Overdue":
        return "destructive";
      case "Partially Paid":
        return "outline"; 
      case "Cancelled":
        return "destructive"; 
      default:
        return "secondary";
    }
  };

  if (isLoading && invoices.length === 0) {
    return <PageHeader title="Billing & Invoicing" description="Loading invoices from database..." icon={FileText} />;
  }

  return (
    <>
      <PageHeader
        title="Billing & Invoicing"
        description="Create and manage GST-compliant bills and invoices. (Admin Access)"
        icon={FileText}
        actions={
          <Button onClick={handleCreateNewInvoice} className="mt-4 sm:mt-0">
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
          {isLoading && invoices.length === 0 ? (
             <div className="text-center py-10 text-muted-foreground">Loading invoices...</div>
          ) : !isLoading && invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
                <p className="text-lg sm:text-xl font-semibold text-muted-foreground">No Invoices Found</p>
                <p className="text-xs sm:text-sm text-muted-foreground mb-6">It seems there are no invoices in the database yet.</p>
                <Button onClick={handleCreateNewInvoice}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create First Invoice
                </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
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
                    <TableCell className="hidden sm:table-cell">{invoice.date}</TableCell>
                    <TableCell className="text-right">{invoice.displayTotal}</TableCell>
                    <TableCell className="text-center">
                      <Badge 
                          variant={getBadgeVariant(invoice.status)}
                          className={
                              invoice.status === "Paid" ? "bg-accent text-accent-foreground" : 
                              invoice.status === "Partially Paid" ? "border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-300 bg-transparent" : 
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
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
