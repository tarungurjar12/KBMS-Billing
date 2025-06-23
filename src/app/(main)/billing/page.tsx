
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
import { collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy, Timestamp, serverTimestamp, where, limit, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import { format, parseISO } from 'date-fns';
import type { UserProfile } from '../my-profile/page';
import { InvoiceTemplate } from '@/components/invoice/invoice-template';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useReactToPrint } from 'react-to-print';
import { cn } from "@/lib/utils";

/**
 * @fileOverview Page for Admin to manage Billing and Invoicing.
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
  consolidatedLedgerEntryIds?: string[];
}

export interface CompanyDetailsForInvoice {
  companyName?: string;
  companyAddress?: string;
  companyContact?: string;
  companyGstin?: string;
  companyLogoUrl?: string;
}

const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getCookie = (name: string): string | undefined => {
  if (typeof window === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

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


export default function BillingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCompanyDetails, setIsLoadingCompanyDetails] = useState(false);
  const [companyDetails, setCompanyDetails] = useState<CompanyDetailsForInvoice | null>(null);
  const [isInvoiceViewOpen, setIsInvoiceViewOpen] = useState(false);
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<Invoice | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>(undefined);
  
  const invoicePrintRef = useRef<HTMLDivElement>(null); 
  const invoicePrintRefForDropdownHidden = useRef<HTMLDivElement>(null); 

  useEffect(() => {
    setCurrentUserRole(getCookie('userRole'));
  }, []);

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

  useEffect(() => {
    fetchCompanyDetails();
  }, [fetchCompanyDetails]);

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

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleCreateNewInvoice = useCallback(() => {
    router.push("/create-bill");
  }, [router]);

  const handleViewInvoice = useCallback((invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      setSelectedInvoiceForView(invoice);
      setIsInvoiceViewOpen(true);
    } else {
      toast({ title: "Error", description: "Invoice details not found.", variant: "destructive" });
    }
  }, [invoices, toast]);

  const handleDownloadPDF = useCallback(async (invoiceToDownload: Invoice | null, companyDetailsForPdf: CompanyDetailsForInvoice | null) => {
    if (!invoiceToDownload || !companyDetailsForPdf) {
      toast({ title: "Error", description: "Invoice or company details not available for PDF generation.", variant: "destructive" });
      return;
    }
  
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px'; // Position off-screen
    tempContainer.style.top = '-9999px';
    tempContainer.style.width = '800px'; // A4-like width for rendering consistency
    tempContainer.style.padding = '20px'; 
    tempContainer.style.background = 'white';
    document.body.appendChild(tempContainer);
    
    let tempRoot: ReturnType<typeof createRoot> | null = null;

    const InvoiceRenderer = ({ invoice, companyDetails, onRendered }: { invoice: Invoice, companyDetails: CompanyDetailsForInvoice, onRendered: (element: HTMLElement) => void }) => {
      const renderRef = React.useRef<HTMLDivElement>(null);
      React.useEffect(() => {
        if (renderRef.current) {
          const timer = setTimeout(() => {
            if (renderRef.current) onRendered(renderRef.current);
          }, 500); 
          return () => clearTimeout(timer);
        }
      }, [invoice, companyDetails, onRendered]);
      return <div ref={renderRef}><InvoiceTemplate invoice={invoice} companyDetails={companyDetails} /></div>;
    };
  
    const generatePdfFromElement = async (element: HTMLElement, currentInvoice: Invoice) => {
      try {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          width: element.scrollWidth,
          height: element.scrollHeight,
          windowWidth: element.scrollWidth,
          windowHeight: element.scrollHeight,
          logging: false,
        });
  
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
  
        pdf.addImage(imgData, 'PNG', margin, currentPosition, availableWidth, imgRenderHeight);
        heightLeft -= (pdfHeight - (2 * margin));
  
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
        if (tempRoot) {
          tempRoot.unmount();
        }
        if (document.body.contains(tempContainer)) {
            document.body.removeChild(tempContainer);
        }
      }
    };
    
    tempRoot = createRoot(tempContainer);
    tempRoot.render(
      <InvoiceRenderer invoice={invoiceToDownload} companyDetails={companyDetailsForPdf} onRendered={(el) => generatePdfFromElement(el, invoiceToDownload)} />
    );
  }, [toast]);
  
  const handleActualPrint = useReactToPrint({
    content: () => {
      if (isInvoiceViewOpen && invoicePrintRef.current) {
        return invoicePrintRef.current;
      }
      if (!isInvoiceViewOpen && invoicePrintRefForDropdownHidden.current) {
        return invoicePrintRefForDropdownHidden.current;
      }
      return null;
    },
    documentTitle: `Invoice-${selectedInvoiceForView?.invoiceNumber || 'details'}`,
    onPrintError: (error) => {
      console.error("Print error:", error);
      toast({ title: "Print Error", description: "Could not print the invoice.", variant: "destructive" });
    }
  });

  const handleEditInvoice = useCallback((invoiceId: string) => {
    router.push(`/create-bill?editInvoiceId=${invoiceId}`); 
  }, [router]);
  
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

  const handleDeleteInvoice = useCallback(async (invoiceId: string, invoiceNumber: string) => {
    if (currentUserRole !== 'admin') {
      toast({ title: "Permission Denied", description: "Only Admins can delete invoices.", variant: "destructive"});
      return;
    }
    try {
      await deleteDoc(doc(db, "invoices", invoiceId));
      toast({ title: "Invoice Deleted", description: `Invoice ${invoiceNumber} has been successfully deleted.`, variant: "default" });
      fetchInvoices(); 
    } catch (error: any) {
      console.error("Error deleting invoice: ", error);
      toast({ title: "Deletion Error", description: `Could not delete invoice: ${error.message}`, variant: "destructive" });
    }
  }, [toast, fetchInvoices, currentUserRole]);
  
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
                  <Card key={invoice.id + "-mobile"} className={cn("flex flex-col justify-between", getStatusRowClass(invoice.status))}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2 p-4 pb-2">
                      <div className="flex-1 space-y-1">
                        <CardTitle className="text-base font-bold">{invoice.customerName}</CardTitle>
                        <CardDescription className="text-xs">{invoice.invoiceNumber} | {invoice.date}</CardDescription>
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
                        <span className="text-xl font-bold">{invoice.displayTotal}</span>
                        <Badge variant={getBadgeVariant(invoice.status)} className={cn(
                          invoice.status === "Paid" && "bg-accent text-accent-foreground",
                          invoice.status === "Partially Paid" && "border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-300 bg-transparent",
                          invoice.status === "Cancelled" && "bg-muted text-muted-foreground border-muted-foreground/30"
                        )}>{invoice.status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

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
