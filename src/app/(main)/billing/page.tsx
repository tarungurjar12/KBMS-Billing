
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from 'react-dom/client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { FileText, PlusCircle, MoreHorizontal, Download, Printer, Edit, Eye, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, Timestamp, serverTimestamp, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import { format, parseISO } from 'date-fns';
import type { UserProfile } from '../my-profile/page';
import { InvoiceTemplate } from '@/components/invoice/invoice-template';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useReactToPrint } from 'react-to-print';
import { cn } from "@/lib/utils";

/**
 * @fileOverview Page for Admin and Store Managers to manage Billing and Invoicing.
 * This page displays a list of all invoices from Firestore, allowing users to view,
 * download, print, edit, update status, and delete invoices based on their roles.
 * It features responsive design with a table for desktops and cards for mobile.
 */

// --- INTERFACES ---

/**
 * @interface InvoiceItem
 * @description Defines the structure of a single item within an invoice.
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
 * @interface Invoice
 * @description Defines the structure of a complete invoice document stored in Firestore.
 */
export interface Invoice {
  id: string; 
  invoiceNumber: string;
  customerName: string;
  customerId: string;
  date: string; // Formatted for display
  isoDate: string; // ISO format for sorting/querying
  totalAmount: number; 
  displayTotal: string; // Formatted currency string
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
  consolidatedLedgerEntryIds?: string[];
}

/**
 * @interface CompanyDetailsForInvoice
 * @description Defines the structure for company information required for rendering on an invoice.
 */
export interface CompanyDetailsForInvoice {
  companyName?: string;
  companyAddress?: string;
  companyContact?: string;
  companyGstin?: string;
  companyLogoUrl?: string;
}

// --- HELPER FUNCTIONS ---

/**
 * Formats a number into a currency string (Indian Rupee).
 * @param {number} num - The number to format.
 * @returns {string} The formatted currency string (e.g., "₹1,000.00").
 */
const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Retrieves a cookie value by name.
 * @param {string} name - The name of the cookie to retrieve.
 * @returns {string | undefined} The cookie value or undefined if not found.
 */
const getCookie = (name: string): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

/**
 * Gets the appropriate CSS class for a table row based on invoice status.
 * @param {Invoice['status']} status - The status of the invoice.
 * @returns {string} The Tailwind CSS class string for background color.
 */
const getStatusRowClass = (status: Invoice['status']): string => {
    switch (status) {
      case "Paid": return "bg-green-50/50 dark:bg-green-500/10";
      case "Pending": return "bg-yellow-50/50 dark:bg-yellow-500/10";
      case "Overdue": return "bg-red-50/50 dark:bg-red-500/10";
      case "Partially Paid": return "bg-blue-50/50 dark:bg-blue-500/10";
      case "Cancelled": return "bg-gray-100/50 dark:bg-gray-800/10";
      default: return "";
    }
};

/**
 * BillingPage Component
 * @description The main component for the billing and invoicing page.
 * Manages state for invoices, loading status, company details, and UI dialogs.
 * @returns {JSX.Element} The rendered billing page.
 */
export default function BillingPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  // --- STATE MANAGEMENT ---
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCompanyDetails, setIsLoadingCompanyDetails] = useState(false);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetailsForInvoice | null>(null);
  const [isInvoiceViewOpen, setIsInvoiceViewOpen] = useState(false);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<Invoice | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>(undefined);
  
  // Refs for printing functionality
  const invoicePrintRef = useRef<HTMLDivElement>(null); 
  const invoicePrintRefForDropdownHidden = useRef<HTMLDivElement>(null); 

  // --- EFFECTS ---

  /**
   * Effect to get the current user's role from cookies on component mount.
   */
  useEffect(() => {
    setCurrentUserRole(getCookie('userRole'));
  }, []);

  /**
   * Callback to fetch company details from the admin's user profile in Firestore.
   * This information is used for rendering invoices.
   */
  const fetchCompanyDetails = useCallback(async () => {
    setIsLoadingCompanyDetails(true);
    try {
      const adminQuery = query(collection(db, "users"), where("role", "==", "admin"), limit(1));
      const adminSnapshot = await getDocs(adminQuery);
      if (!adminSnapshot.empty) {
        const adminData = adminSnapshot.docs[0].data() as UserProfile;
        setCompanyDetails({
          companyName: adminData.companyName,
          companyAddress: adminData.companyAddress,
          companyContact: adminData.companyContact,
          companyGstin: adminData.companyGstin,
          companyLogoUrl: adminData.companyLogoUrl,
        });
      } else {
        console.warn("No admin user found with company details.");
        setCompanyDetails(null);
      }
    } catch (error) {
      console.error("Error fetching company details: ", error);
      toast({ title: "Error", description: "Could not load company details for invoice.", variant: "destructive" });
      setCompanyDetails(null);
    } finally {
      setIsLoadingCompanyDetails(false);
    }
  }, [toast]);

  /**
   * Effect to trigger fetching company details.
   */
  useEffect(() => {
    fetchCompanyDetails();
  }, [fetchCompanyDetails]);

  /**
   * Callback to fetch all invoices from Firestore, ordered by most recent.
   * Handles various date formats from the database for robustness.
   */
  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "invoices"), orderBy("isoDate", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedInvoices = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        let invoiceDate = "Date N/A";
        let finalIsoDate = new Date().toISOString(); 

        // Robust date parsing for backward compatibility with string or Timestamp formats
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
          consolidatedLedgerEntryIds: data.consolidatedLedgerEntryIds || [],
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

  /**
   * Effect to trigger fetching invoices.
   */
  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // --- EVENT HANDLERS ---

  /**
   * Navigates to the page for creating a new invoice.
   */
  const handleCreateNewInvoice = useCallback(() => {
    router.push("/create-bill");
  }, [router]);

  /**
   * Opens the invoice view dialog for a selected invoice.
   * @param {string} invoiceId - The ID of the invoice to view.
   */
  const handleViewInvoice = useCallback((invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      setSelectedInvoiceForView(invoice);
      setIsInvoiceViewOpen(true);
    } else {
      toast({ title: "Error", description: "Invoice details not found.", variant: "destructive" });
    }
  }, [invoices, toast]);

  /**
   * Generates and triggers the download of a PDF for a selected invoice.
   * It dynamically renders the invoice component off-screen to generate a high-quality canvas,
   * then uses jsPDF to create the PDF file.
   * @param {Invoice | null} invoiceToDownload - The invoice object to be downloaded.
   * @param {CompanyDetailsForInvoice | null} companyDetailsForPdf - The company details to render on the PDF.
   */
  const handleDownloadPDF = useCallback(async (invoiceToDownload: Invoice | null, companyDetailsForPdf: CompanyDetailsForInvoice | null) => {
    if (!invoiceToDownload || !companyDetailsForPdf) {
      toast({ title: "Error", description: "Invoice or company details not available for PDF generation.", variant: "destructive" });
      return;
    }
  
    // Create a temporary, off-screen container to render the invoice for PDF generation
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px'; 
    tempContainer.style.top = '-9999px';
    tempContainer.style.width = '800px'; 
    tempContainer.style.padding = '20px'; 
    tempContainer.style.background = 'white';
    document.body.appendChild(tempContainer);
    
    let tempRoot: ReturnType<typeof createRoot> | null = null;

    // A temporary renderer component to ensure the invoice template is fully rendered before canvas conversion
    const InvoiceRenderer = ({ invoice, companyDetails, onRendered }: { invoice: Invoice, companyDetails: CompanyDetailsForInvoice, onRendered: (element: HTMLElement) => void }) => {
      const renderRef = React.useRef<HTMLDivElement>(null);
      React.useEffect(() => {
        if (renderRef.current) {
          const timer = setTimeout(() => { // Small delay to ensure all styles are applied
            if (renderRef.current) onRendered(renderRef.current);
          }, 500); 
          return () => clearTimeout(timer);
        }
      }, [invoice, companyDetails, onRendered]);
      return <div ref={renderRef}><InvoiceTemplate invoice={invoice} companyDetails={companyDetails} /></div>;
    };
  
    // Function to generate the PDF from the rendered HTML element
    const generatePdfFromElement = async (element: HTMLElement, currentInvoice: Invoice) => {
      try {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, width: element.scrollWidth, height: element.scrollHeight, windowWidth: element.scrollWidth, windowHeight: element.scrollHeight, logging: false });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgProps = pdf.getImageProperties(imgData);
  
        const margin = 20;
        const availableWidth = pdfWidth - (2 * margin);
        const imgRenderHeight = (imgProps.height * availableWidth) / imgProps.width;
        let currentPosition = margin;
        let heightLeft = imgRenderHeight;
  
        // Add image to the first page
        pdf.addImage(imgData, 'PNG', margin, currentPosition, availableWidth, imgRenderHeight);
        heightLeft -= (pdfHeight - (2 * margin));
  
        // Add subsequent pages if content overflows
        while (heightLeft > 0) {
          pdf.addPage();
          currentPosition -= (pdfHeight - (2 * margin)); 
          pdf.addImage(imgData, 'PNG', margin, currentPosition, availableWidth, imgRenderHeight);
          heightLeft -= (pdfHeight - (2 * margin));
        }
  
        pdf.save(`Invoice-${currentInvoice.invoiceNumber}.pdf`);
        toast({ title: "PDF Downloaded", description: `Invoice ${currentInvoice.invoiceNumber}.pdf started downloading.` });
      } catch (error) {
        console.error("Error generating PDF:", error);
        toast({ title: "PDF Generation Error", description: "Could not generate PDF.", variant: "destructive" });
      } finally {
        // Cleanup the temporary elements
        if (tempRoot) tempRoot.unmount();
        if (document.body.contains(tempContainer)) document.body.removeChild(tempContainer);
      }
    };
    
    // Render the invoice off-screen and trigger PDF generation
    tempRoot = createRoot(tempContainer);
    tempRoot.render(
      <InvoiceRenderer invoice={invoiceToDownload} companyDetails={companyDetailsForPdf} onRendered={(el) => generatePdfFromElement(el, invoiceToDownload)} />
    );
  }, [toast]);
  
  /**
   * Hook for handling the browser's print functionality.
   */
  const handleActualPrint = useReactToPrint({
    content: () => {
      if (isInvoiceViewOpen && invoicePrintRef.current) return invoicePrintRef.current;
      if (!isInvoiceViewOpen && invoicePrintRefForDropdownHidden.current) return invoicePrintRefForDropdownHidden.current;
      return null;
    },
    documentTitle: `Invoice-${selectedInvoiceForView?.invoiceNumber || 'details'}`,
    onPrintError: (error) => {
      console.error("Print error:", error);
      toast({ title: "Print Error", description: "Could not print the invoice.", variant: "destructive" });
    }
  });

  /**
   * Navigates to the create/edit bill page with the specific invoice ID as a query parameter.
   * @param {string} invoiceId - The ID of the invoice to edit.
   */
  const handleEditInvoice = useCallback((invoiceId: string) => {
    router.push(`/create-bill?editInvoiceId=${invoiceId}`); 
  }, [router]);
  
  /**
   * Updates the status of an invoice in Firestore.
   * @param {string} invoiceId - The ID of the invoice to update.
   * @param {Invoice['status']} newStatus - The new status to set.
   */
  const handleUpdateStatus = useCallback(async (invoiceId: string, newStatus: Invoice['status']) => {
    try {
      const invoiceRef = doc(db, "invoices", invoiceId);
      await updateDoc(invoiceRef, { status: newStatus, updatedAt: serverTimestamp() });
      toast({ title: "Status Updated", description: `Invoice status changed to ${newStatus}.` });
      fetchInvoices(); 
    } catch (error: any) {
      console.error("Error updating invoice status: ", error);
      toast({ title: "Update Error", description: `Could not update invoice status: ${error.message}`, variant: "destructive" });
    }
  }, [toast, fetchInvoices]);

  /**
   * Deletes an invoice from Firestore. This action is restricted to admins.
   * @param {string} invoiceId - The ID of the invoice to delete.
   * @param {string} invoiceNumber - The invoice number for display in notifications.
   */
  const handleDeleteInvoice = useCallback(async (invoiceId: string, invoiceNumber: string) => {
    if (currentUserRole !== 'admin') {
      toast({ title: "Permission Denied", description: "Only Admins can delete invoices.", variant: "destructive"});
      return;
    }
    // Future enhancement: Add a confirmation dialog before deleting.
    try {
      await deleteDoc(doc(db, "invoices", invoiceId));
      toast({ title: "Invoice Deleted", description: `Invoice ${invoiceNumber} has been successfully deleted.`, variant: "default" });
      fetchInvoices(); 
    } catch (error: any) {
      console.error("Error deleting invoice: ", error);
      toast({ title: "Deletion Error", description: `Could not delete invoice: ${error.message}`, variant: "destructive" });
    }
  }, [toast, fetchInvoices, currentUserRole]);
  
  /**
   * Gets the variant for the Badge component based on invoice status.
   * @param {Invoice['status']} status - The status of the invoice.
   * @returns {"default" | "secondary" | "destructive" | "outline"} The badge variant.
   */
  const getBadgeVariant = (status: Invoice['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "Paid": return "default"; 
      case "Pending": return "secondary";
      case "Overdue": return "destructive";
      case "Partially Paid": return "outline"; 
      case "Cancelled": return "destructive"; 
      default: return "secondary";
    }
  };

  // --- RENDER LOGIC ---

  // Display a loading state while fetching initial data
  if (isLoading && invoices.length === 0) {
    return <PageHeader title="Billing & Invoicing" description="Loading invoices from database..." icon={FileText} />;
  }

  return (
    <>
      <PageHeader
        title="Billing & Invoicing"
        description="Create and manage GST-compliant bills and invoices."
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
            // Empty state display
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
                <p className="text-lg sm:text-xl font-semibold text-muted-foreground">No Invoices Found</p>
                <p className="text-xs sm:text-sm text-muted-foreground mb-6">It seems there are no invoices in the database yet.</p>
                <Button onClick={handleCreateNewInvoice}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create First Invoice
                </Button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
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
                      <TableRow key={invoice.id} className={getStatusRowClass(invoice.status)}>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{invoice.customerName}</TableCell>
                        <TableCell>{invoice.date}</TableCell>
                        <TableCell className="text-right">{invoice.displayTotal}</TableCell>
                        <TableCell className="text-center">
                          <Badge 
                              variant={getBadgeVariant(invoice.status)}
                              className={cn(
                                  invoice.status === "Paid" && "bg-accent text-accent-foreground",
                                  invoice.status === "Partially Paid" && "border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-300 bg-transparent",
                                  invoice.status === "Cancelled" && "bg-muted text-muted-foreground border-muted-foreground/30"
                              )}
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
                               <DropdownMenuItem onClick={() => {
                                    const invoiceForAction = invoices.find(inv => inv.id === invoice.id);
                                    if (invoiceForAction && companyDetails) {
                                        handleDownloadPDF(invoiceForAction, companyDetails);
                                    } else if (!companyDetails) {
                                        toast({ title: "Info", description: "Company details still loading, please try again shortly.", variant: "default" });
                                    } else {
                                        toast({ title: "Error", description: "Invoice details not found for PDF generation.", variant: "destructive" });
                                    }
                               }}>
                                  <Download className="mr-2 h-4 w-4" /> Download PDF
                              </DropdownMenuItem>
                               <DropdownMenuItem onClick={() => {
                                    const invoiceForAction = invoices.find(inv => inv.id === invoice.id);
                                    if (invoiceForAction) {
                                        setSelectedInvoiceForView(invoiceForAction); 
                                        setTimeout(() => handleActualPrint(), 0); 
                                    }
                               }}>
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
                              {currentUserRole === 'admin' && <DropdownMenuSeparator />}
                              <DropdownMenuItem 
                                onClick={() => handleDeleteInvoice(invoice.id, invoice.invoiceNumber)} 
                                className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground"
                                disabled={currentUserRole !== 'admin'}
                              >
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

              {/* Mobile Card View */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
                {invoices.map((invoice) => (
                  <Card key={invoice.id + "-mobile"} className={cn("flex flex-col", getStatusRowClass(invoice.status))}>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 p-4 pb-2">
                       <div className="flex-1 space-y-1 overflow-hidden">
                          <CardTitle className="text-base font-bold truncate">{invoice.customerName}</CardTitle>
                          <CardDescription className="text-xs">{invoice.invoiceNumber}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions for {invoice.invoiceNumber}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewInvoice(invoice.id)}><Eye className="mr-2 h-4 w-4" /> View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                              const invoiceForAction = invoices.find(inv => inv.id === invoice.id);
                              if (invoiceForAction && companyDetails) handleDownloadPDF(invoiceForAction, companyDetails);
                          }}><Download className="mr-2 h-4 w-4" /> PDF</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                              const invoiceForAction = invoices.find(inv => inv.id === invoice.id);
                              if (invoiceForAction) { setSelectedInvoiceForView(invoiceForAction); setTimeout(() => handleActualPrint(), 0); }
                          }}><Printer className="mr-2 h-4 w-4" /> Print</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEditInvoice(invoice.id)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {invoice.status !== "Paid" && <DropdownMenuItem onClick={() => handleUpdateStatus(invoice.id, "Paid")}>Mark as Paid</DropdownMenuItem>}
                          {invoice.status !== "Pending" && <DropdownMenuItem onClick={() => handleUpdateStatus(invoice.id, "Pending")}>Mark as Pending</DropdownMenuItem>}
                          {invoice.status !== "Overdue" && <DropdownMenuItem onClick={() => handleUpdateStatus(invoice.id, "Overdue")}>Mark as Overdue</DropdownMenuItem>}
                          {invoice.status !== "Cancelled" && <DropdownMenuItem onClick={() => handleUpdateStatus(invoice.id, "Cancelled")}>Mark as Cancelled</DropdownMenuItem>}
                          {currentUserRole === 'admin' && <DropdownMenuSeparator />}
                          <DropdownMenuItem onClick={() => handleDeleteInvoice(invoice.id, invoice.invoiceNumber)} disabled={currentUserRole !== 'admin'} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex justify-between items-center">
                         <div className="text-sm text-muted-foreground">
                            {invoice.date}
                          </div>
                         <Badge variant={getBadgeVariant(invoice.status)} className={cn(
                          "text-xs",
                          invoice.status === "Paid" && "bg-accent text-accent-foreground",
                          invoice.status === "Partially Paid" && "border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-300 bg-transparent",
                          invoice.status === "Cancelled" && "bg-muted text-muted-foreground border-muted-foreground/30"
                        )}>{invoice.status}</Badge>
                      </div>
                       <div className="text-right text-xl font-bold mt-1">
                          {invoice.displayTotal}
                        </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Invoice View Dialog */}
      <Dialog open={isInvoiceViewOpen} onOpenChange={setIsInvoiceViewOpen}>
        <DialogContent className="max-w-3xl w-[90vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Invoice Details: {selectedInvoiceForView?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Customer: {selectedInvoiceForView?.customerName} | Total: {selectedInvoiceForView?.displayTotal}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-y-auto p-2" ref={invoicePrintRef}>
            {isLoadingCompanyDetails && <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading company details...</span></div>}
            {!isLoadingCompanyDetails && selectedInvoiceForView && companyDetails && (
              <InvoiceTemplate invoice={selectedInvoiceForView} companyDetails={companyDetails} />
            )}
            {!isLoadingCompanyDetails && selectedInvoiceForView && !companyDetails && (
                <div className="text-center text-red-500 p-4">Company details could not be loaded. Invoice display may be incomplete.</div>
            )}
          </div>
           <div className="flex flex-col sm:flex-row justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => setIsInvoiceViewOpen(false)} className="w-full sm:w-auto">Close</Button>
              <Button onClick={() => handleDownloadPDF(selectedInvoiceForView, companyDetails)} disabled={!selectedInvoiceForView || isLoadingCompanyDetails || !companyDetails} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" /> Download PDF
              </Button>
              <Button onClick={handleActualPrint} disabled={!selectedInvoiceForView || isLoadingCompanyDetails || !companyDetails} className="w-full sm:w-auto">
                <Printer className="mr-2 h-4 w-4" /> Print Invoice
              </Button>
            </div>
        </DialogContent>
      </Dialog>
      
      {/* Hidden component for direct printing from dropdown menu */}
      <div style={{ display: "none" }}> 
          <div ref={invoicePrintRefForDropdownHidden}>
            {selectedInvoiceForView && companyDetails && (
                 <InvoiceTemplate invoice={selectedInvoiceForView} companyDetails={companyDetails} />
            )}
          </div>
      </div>
    </>
  );
}
