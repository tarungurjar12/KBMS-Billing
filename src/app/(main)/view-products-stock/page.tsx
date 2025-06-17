
"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageSearch, AlertTriangle, Info, FileWarning } from "lucide-react"; 
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
import type { User as FirebaseUser } from "firebase/auth";
import type { Product } from './../products/page'; // Re-using Product interface from Admin section

/**
 * @fileOverview Page for Store Managers to view product prices and stock levels from Firestore.
 * This page provides read-only access to product information.
 * Managers can report issues with product details, price, or stock to the Admin via a Firestore 'issueReports' collection.
 * Data is fetched from Firebase Firestore.
 */

/**
 * Interface extending Product for stock-specific display, including calculated stock status.
 */
export interface ProductInfo extends Product { 
  status: "In Stock" | "Low Stock" | "Out of Stock"; // Calculated stock status
}

// Zod schema for the issue report form validation
const issueReportSchema = z.object({
  productId: z.string().min(1, "Product ID is missing."), // Should be hidden and auto-filled
  productName: z.string().min(1, "Product name is missing."), // Should be hidden and auto-filled
  issueDescription: z.string().min(10, { message: "Please provide a detailed description of the issue (at least 10 characters)." }).max(500, {message: "Description too long (max 500 characters)."}),
});

type IssueReportFormValues = z.infer<typeof issueReportSchema>;

const LOW_STOCK_THRESHOLD = 50; // Example threshold, could be fetched from app settings or per-product in future

/**
 * Formats a number as an Indian Rupee string.
 * @param {number} num - The number to format.
 * @returns {string} A string representing the currency, e.g., "₹1,234.56".
 */
const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * ViewProductsStockPage component.
 * Allows Store Managers to view product and stock information from Firestore and report issues.
 * @returns {JSX.Element} The rendered view products/stock page.
 */
export default function ViewProductsStockPage() {
  const [productsList, setProductsList] = useState<ProductInfo[]>([]); // Renamed to avoid conflict
  const [isLoading, setIsLoading] = useState(true);
  const [isReportIssueDialogOpen, setIsReportIssueDialogOpen] = useState(false);
  const [productToReport, setProductToReport] = useState<ProductInfo | null>(null);
  const { toast } = useToast();

  // React Hook Form setup for the issue report dialog
  const form = useForm<IssueReportFormValues>({
    resolver: zodResolver(issueReportSchema),
    defaultValues: { productId: "", productName: "", issueDescription: "" },
  });

  /**
   * Determines the stock status string based on quantity and threshold.
   * @param {number} stock - The current stock quantity.
   * @returns {ProductInfo['status']} The stock status string.
   */
  const getStatus = useCallback((stock: number): ProductInfo['status'] => {
    if (stock <= 0) return "Out of Stock";
    if (stock < LOW_STOCK_THRESHOLD) return "Low Stock";
    return "In Stock";
  }, []); 

  /**
   * Fetches product data from Firestore's 'products' collection.
   * Orders products by name and calculates stock status for display.
   */
  const fetchProductData = useCallback(async () => { // Renamed to avoid conflict
    setIsLoading(true);
    try {
      const q = query(collection(db, "products"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedItems = querySnapshot.docs.map(docSnapshot => { // Renamed to avoid conflict
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          name: data.name,
          sku: data.sku,
          price: formatCurrency(data.numericPrice || 0),
          numericPrice: data.numericPrice || 0,
          stock: data.stock || 0,
          category: data.category || "Other",
          imageUrl: data.imageUrl || `https://placehold.co/40x40.png?text=${encodeURIComponent(data.name.substring(0,2).toUpperCase())}`,
          dataAiHint: data.dataAiHint || "product item",
          status: getStatus(data.stock || 0),
          unitOfMeasure: data.unitOfMeasure || "pcs",
          description: data.description || "No description available.", // Default description
        } as ProductInfo;
      });
      setProductsList(fetchedItems);
    } catch (error: any) {
      console.error("Error fetching products: ", error);
      if (error.code === 'failed-precondition') {
         toast({
            title: "Database Index Required",
            description: `A query for products failed. Please create the required Firestore index for 'products' collection (orderBy 'name' ascending). Check your browser's developer console for a Firebase link to create it.`,
            variant: "destructive", duration: 15000,
        });
      } else {
        toast({ title: "Database Error", description: "Could not load product data. Please try again.", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast, getStatus]);

  // Fetch products when the component mounts
  useEffect(() => {
    fetchProductData();
  }, [fetchProductData]);

  /**
   * Opens the issue report dialog and pre-fills form with selected product's ID and name.
   * @param {ProductInfo} product - The product for which to report an issue.
   */
  const openReportIssueDialog = (product: ProductInfo) => {
    setProductToReport(product);
    form.reset({ 
        productId: product.id, 
        productName: product.name, 
        issueDescription: "" 
    });
    setIsReportIssueDialogOpen(true);
  };

  /**
   * Handles submission of the issue report form.
   * Saves the report to the 'issueReports' collection in Firestore.
   * @param {IssueReportFormValues} values - The validated form values.
   */
  const handleReportIssueSubmit = async (values: IssueReportFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({ title: "Authentication Error", description: "You must be logged in to report an issue.", variant: "destructive" });
      return;
    }
    try {
      // Add the issue report to Firestore
      await addDoc(collection(db, "issueReports"), {
        ...values, // Contains productId, productName, issueDescription
        reportedByUid: currentUser.uid,
        reportedByEmail: currentUser.email,
        reportedAt: serverTimestamp(), // Firestore server-side timestamp
        status: "New", // Initial status of the report (e.g., New, Investigating, Resolved)
        productSku: productToReport?.sku || "N/A", // Include SKU for easier admin lookup
      });
      toast({ title: "Issue Reported Successfully", description: `Thank you! Your report for ${values.productName} has been submitted to the Admin.` });
      setIsReportIssueDialogOpen(false); // Close the dialog
      setProductToReport(null);
      form.reset(); // Reset the form
    } catch (error) {
      console.error("Error submitting issue report: ", error);
      toast({ title: "Report Submission Failed", description: "Failed to submit issue report to the database. Please try again.", variant: "destructive" });
    }
  };

  // Display loading state
  if (isLoading && productsList.length === 0) {
    return <PageHeader title="View Products & Stock" description="Loading product data from database..." icon={PackageSearch} />;
  }

  return (
    <>
      <PageHeader
        title="View Products & Stock"
        description="Check product prices and current stock levels (Read-Only). Report any discrepancies to Admin."
        icon={PackageSearch}
      />

      {/* Informational Card for Store Managers */}
      <Card className="mb-6 bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700 shadow-md">
        <CardHeader className="pb-2">
            <CardTitle className="text-sky-700 dark:text-sky-300 flex items-center text-lg">
                <Info className="mr-2 h-5 w-5"/> Information for Store Managers
            </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-sky-600 dark:text-sky-400">
            <p>This page provides a read-only view of product details, prices, and current stock levels.</p>
            <p className="mt-1">If you notice any incorrect information (e.g., wrong price, inaccurate stock count, missing details), please use the &quot;Report Issue&quot; button next to the item to notify the Admin.</p>
        </CardContent>
      </Card>

      {/* Dialog for Reporting an Issue */}
      <Dialog open={isReportIssueDialogOpen} onOpenChange={(isOpen) => { 
          if(!isOpen) { 
            setProductToReport(null); 
            form.reset(); // Reset form when dialog closes
          } 
          setIsReportIssueDialogOpen(isOpen);
      }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Report Issue for &quot;{productToReport?.name}&quot;</DialogTitle>
            <DialogDescription>
              Spotted an error in product details, price, or stock for SKU: {productToReport?.sku}? 
              Please describe the issue clearly for the Admin.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleReportIssueSubmit)} className="space-y-4 py-2">
              {/* Hidden fields for productId and productName are set via form.reset in openReportIssueDialog */}
              <FormField control={form.control} name="issueDescription" render={({ field }) => (
                  <FormItem><FormLabel>Describe the Issue</FormLabel>
                    <FormControl><Textarea placeholder="e.g., The price shown is ₹XX.XX but should be ₹YY.YY, or stock level shows 10 but we only have 5." {...field} rows={5} /></FormControl>
                    <FormMessage />
                  </FormItem>)} />
              <DialogFooter className="pt-4">
                 <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Submitting Report..." : "Submit Issue Report"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Tabs for Price List and Stock List */}
      <Tabs defaultValue="price_list" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 sm:w-[400px] mb-4">
          <TabsTrigger value="price_list">Product Price List</TabsTrigger>
          <TabsTrigger value="stock_list">Current Stock Levels</TabsTrigger>
        </TabsList>
        <TabsContent value="price_list">
          <Card className="shadow-lg rounded-xl">
            <CardHeader><CardTitle className="font-headline text-foreground">Product Price List</CardTitle><CardDescription>Complete list of products and their current selling prices.</CardDescription></CardHeader>
            <CardContent>
              {isLoading && productsList.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">Loading price list...</div>
              ) : !isLoading && productsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <FileWarning className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-xl font-semibold text-muted-foreground">No Products Found</p>
                    <p className="text-sm text-muted-foreground">The product database appears to be empty.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                      <TableHead className="w-[60px] sm:w-[80px]">Image</TableHead><TableHead>Product Name</TableHead>
                      <TableHead className="hidden md:table-cell">SKU</TableHead><TableHead className="hidden lg:table-cell">Category</TableHead>
                      <TableHead>Unit</TableHead><TableHead className="text-right">Price (₹)</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {productsList.map((product) => (
                      <TableRow key={product.id + "-price"}>
                        <TableCell>
                          <Image 
                              src={product.imageUrl} 
                              alt={product.name} 
                              width={40} height={40} 
                              className="rounded-md object-cover border" 
                              data-ai-hint={product.dataAiHint}
                              onError={(e) => { e.currentTarget.src = `https://placehold.co/40x40.png?text=${encodeURIComponent(product.name.substring(0,2).toUpperCase())}`; }} // Fallback image
                          />
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="hidden md:table-cell">{product.sku}</TableCell>
                        <TableCell className="hidden lg:table-cell">{product.category}</TableCell>
                        <TableCell>{product.unitOfMeasure}</TableCell>
                        <TableCell className="text-right font-semibold">{product.price}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openReportIssueDialog(product)} title={`Report issue with ${product.name}`}>
                              <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Report Issue
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="stock_list">
          <Card className="shadow-lg rounded-xl">
            <CardHeader><CardTitle className="font-headline text-foreground">Current Stock Levels</CardTitle><CardDescription>View current inventory status for all products.</CardDescription></CardHeader>
            <CardContent>
              {isLoading && productsList.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">Loading stock levels...</div>
              ) : !isLoading && productsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <FileWarning className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-xl font-semibold text-muted-foreground">No Products Found</p>
                    <p className="text-sm text-muted-foreground">The product database appears to be empty.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                      <TableHead className="w-[60px] sm:w-[80px]">Image</TableHead><TableHead>Product Name</TableHead>
                      <TableHead className="hidden md:table-cell">SKU</TableHead><TableHead>Unit</TableHead>
                      <TableHead className="text-right">Current Stock</TableHead><TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {productsList.map((item) => (
                      <TableRow key={item.id + "-stock"}>
                        <TableCell>
                          <Image 
                              src={item.imageUrl} 
                              alt={item.name} 
                              width={40} height={40} 
                              className="rounded-md object-cover border" 
                              data-ai-hint={item.dataAiHint}
                              onError={(e) => { e.currentTarget.src = `https://placehold.co/40x40.png?text=${encodeURIComponent(item.name.substring(0,2).toUpperCase())}`; }} // Fallback image
                          />
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="hidden md:table-cell">{item.sku}</TableCell>
                        <TableCell>{item.unitOfMeasure}</TableCell>
                        <TableCell className="text-right font-semibold">{item.stock}</TableCell>
                        <TableCell className="text-center">
                          <Badge 
                             variant={item.status === "In Stock" ? "default" : item.status === "Low Stock" ? "secondary" : "destructive"}
                             className={
                                 item.status === "In Stock" ? "bg-accent text-accent-foreground" : 
                                 item.status === "Low Stock" ? "bg-yellow-400 text-yellow-900 dark:bg-yellow-600 dark:text-yellow-100 border-yellow-500" : ""
                             } // Custom styles for Low Stock
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => openReportIssueDialog(item)} title={`Report issue with ${item.name}`}>
                             <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Report Issue
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

