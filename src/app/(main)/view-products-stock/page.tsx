
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
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy, Timestamp, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
import type { User as FirebaseUser } from "firebase/auth";
import type { Product } from './../products/page'; 

/**
 * @fileOverview Page for Store Managers to view product prices and stock levels from Firestore.
 * This page provides read-only access to product information.
 * Managers can report issues with product details, price, or stock to the Admin via a Firestore 'issueReports' collection.
 * Data is fetched from Firebase Firestore.
 */

export interface ProductInfo extends Product { 
  status: "In Stock" | "Low Stock" | "Out of Stock"; 
}

const issueReportSchema = z.object({
  productId: z.string().min(1, "Product ID is missing."), 
  productName: z.string().min(1, "Product name is missing."), 
  issueDescription: z.string().min(10, { message: "Please provide a detailed description of the issue (at least 10 characters)." }).max(500, {message: "Description too long (max 500 characters)."}),
});

type IssueReportFormValues = z.infer<typeof issueReportSchema>;

const LOW_STOCK_THRESHOLD = 50; 

const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ViewProductsStockPage() {
  const [productsList, setProductsList] = useState<ProductInfo[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [isReportIssueDialogOpen, setIsReportIssueDialogOpen] = useState(false);
  const [productToReport, setProductToReport] = useState<ProductInfo | null>(null);
  const { toast } = useToast();

  const form = useForm<IssueReportFormValues>({
    resolver: zodResolver(issueReportSchema),
    defaultValues: { productId: "", productName: "", issueDescription: "" },
  });

  const getStatus = useCallback((stock: number): ProductInfo['status'] => {
    if (stock <= 0) return "Out of Stock";
    if (stock < LOW_STOCK_THRESHOLD) return "Low Stock";
    return "In Stock";
  }, []); 

  const fetchProductData = useCallback(async () => { 
    setIsLoading(true);
    try {
      const q = query(collection(db, "products"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedItems = querySnapshot.docs.map(docSnapshot => { 
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
          description: data.description || "No description available.", 
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

  useEffect(() => {
    fetchProductData();
  }, [fetchProductData]);

  const openReportIssueDialog = (product: ProductInfo) => {
    setProductToReport(product);
    form.reset({ 
        productId: product.id, 
        productName: product.name, 
        issueDescription: "" 
    });
    setIsReportIssueDialogOpen(true);
  };

  const handleReportIssueSubmit = async (values: IssueReportFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({ title: "Authentication Error", description: "You must be logged in to report an issue.", variant: "destructive" });
      return;
    }
    try {
      // Step 1: Create the issue report
      const issueReportRef = await addDoc(collection(db, "issueReports"), {
        ...values, 
        reportedByUid: currentUser.uid,
        reportedByEmail: currentUser.email,
        reportedAt: serverTimestamp(), 
        status: "New", 
        productSku: productToReport?.sku || "N/A", 
      });

      // Step 2: Find all admins to notify them
      const adminQuery = query(collection(db, "users"), where("role", "==", "admin"));
      const adminSnapshot = await getDocs(adminQuery);

      if (adminSnapshot.empty) {
          console.warn("No admin users found to notify about the issue.");
      } else {
        // Step 3: Create a notification for each admin
        const notificationPromises = adminSnapshot.docs.map(adminDoc => {
            const admin = adminDoc.data();
            return addDoc(collection(db, "notifications"), {
                recipientUid: admin.uid,
                title: `New Issue Reported: ${values.productName}`,
                message: `Manager ${currentUser.displayName || currentUser.email} reported an issue. Click to review.`,
                link: `/products?highlight=${values.productId}`,
                isRead: false,
                createdAt: serverTimestamp(),
                // New fields for resolution workflow
                type: 'issue_report',
                relatedDocId: issueReportRef.id,
                originatorUid: currentUser.uid,
                originatorName: currentUser.displayName || currentUser.email || 'Unknown Manager',
                productName: values.productName,
            });
        });
        await Promise.all(notificationPromises);
      }

      toast({ title: "Issue Reported Successfully", description: `Thank you! Your report for ${values.productName} has been submitted to the Admin.` });
      setIsReportIssueDialogOpen(false); 
      setProductToReport(null);
      form.reset(); 
    } catch (error) {
      console.error("Error submitting issue report: ", error);
      toast({ title: "Report Submission Failed", description: "Failed to submit issue report to the database. Please try again.", variant: "destructive" });
    }
  };

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

      <Card className="mb-6 bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700 shadow-md">
        <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sky-700 dark:text-sky-300 flex items-center text-lg">
                <Info className="mr-2 h-5 w-5"/> Information for Store Managers
            </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-sky-600 dark:text-sky-400 pb-4">
            <p>This page provides a read-only view of product details, prices, and current stock levels.</p>
            <p className="mt-1">If you notice any incorrect information (e.g., wrong price, inaccurate stock count, missing details), please use the &quot;Report Issue&quot; button next to the item to notify the Admin.</p>
        </CardContent>
      </Card>

      <Dialog open={isReportIssueDialogOpen} onOpenChange={(isOpen) => { 
          if(!isOpen) { 
            setProductToReport(null); 
            form.reset(); 
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
              <FormField control={form.control} name="issueDescription" render={({ field }) => (
                  <FormItem><FormLabel>Describe the Issue</FormLabel>
                    <FormControl><Textarea placeholder="e.g., The price shown is ₹XX.XX but should be ₹YY.YY, or stock level shows 10 but we only have 5." {...field} rows={5} /></FormControl>
                    <FormMessage />
                  </FormItem>)} />
              <DialogFooter className="pt-4 flex flex-col sm:flex-row gap-2">
                 <DialogClose asChild><Button type="button" variant="outline" className="w-full sm:w-auto">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
                  {form.formState.isSubmitting ? "Submitting Report..." : "Submit Issue Report"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="price_list" className="w-full">
        <TabsList className="grid w-full grid-cols-1 mb-4 sm:flex sm:h-10 sm:flex-row flex-col items-stretch h-auto sm:w-auto max-w-md">
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
                    <FileWarning className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
                    <p className="text-lg sm:text-xl font-semibold text-muted-foreground">No Products Found</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">The product database appears to be empty.</p>
                </div>
              ) : (
                <>
                {/* Desktop View */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                        <TableHead className="w-[40px] sm:w-[60px]">Image</TableHead><TableHead>Product Name</TableHead>
                        <TableHead className="hidden md:table-cell">SKU</TableHead><TableHead className="hidden lg:table-cell">Category</TableHead>
                        <TableHead className="hidden sm:table-cell">Unit</TableHead><TableHead className="text-right">Price (₹)</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {productsList.map((product) => (
                        <TableRow key={product.id + "-price"}>
                          <TableCell>
                            <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md object-cover border" data-ai-hint={product.dataAiHint} onError={(e) => { e.currentTarget.src = `https://placehold.co/40x40.png?text=${encodeURIComponent(product.name.substring(0,2).toUpperCase())}`; }} />
                          </TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="hidden md:table-cell">{product.sku}</TableCell>
                          <TableCell className="hidden lg:table-cell">{product.category}</TableCell>
                          <TableCell className="hidden sm:table-cell">{product.unitOfMeasure}</TableCell>
                          <TableCell className="text-right font-semibold">{product.price}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="hover:bg-destructive hover:text-destructive-foreground focus-visible:bg-destructive/10 focus-visible:text-destructive" onClick={() => openReportIssueDialog(product)} title={`Report issue with ${product.name}`}>
                              <AlertTriangle className="h-4 w-4 lg:mr-2" /><span className="hidden lg:inline">Report Issue</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile View */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
                    {productsList.map((product) => (
                        <Card key={product.id + "-price-mobile"}>
                            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                                <div className="flex-1 space-y-1">
                                    <CardTitle className="text-base leading-tight">{product.name}</CardTitle>
                                    <CardDescription className="text-xs">SKU: {product.sku}</CardDescription>
                                </div>
                                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 hover:bg-destructive hover:text-destructive-foreground" onClick={() => openReportIssueDialog(product)} title={`Report issue with ${product.name}`}>
                                    <AlertTriangle className="h-4 w-4" />
                                    <span className="sr-only">Report Issue</span>
                                </Button>
                            </CardHeader>
                            <CardContent className="text-sm pt-2">
                               <div className="flex justify-between items-center text-lg font-semibold">
                                   <span>Price:</span>
                                   <span>{product.price}</span>
                               </div>
                                <p className="text-xs text-muted-foreground">per {product.unitOfMeasure}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                </>
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
                    <FileWarning className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
                    <p className="text-lg sm:text-xl font-semibold text-muted-foreground">No Products Found</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">The product database appears to be empty.</p>
                </div>
              ) : (
                <>
                {/* Desktop View */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                        <TableHead className="w-[40px] sm:w-[60px]">Image</TableHead><TableHead>Product Name</TableHead>
                        <TableHead className="hidden md:table-cell">SKU</TableHead>
                        <TableHead className="hidden sm:table-cell">Unit</TableHead>
                        <TableHead className="text-right">Current Stock</TableHead><TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {productsList.map((item) => (
                        <TableRow key={item.id + "-stock"}>
                          <TableCell>
                            <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="rounded-md object-cover border" data-ai-hint={item.dataAiHint} onError={(e) => { e.currentTarget.src = `https://placehold.co/40x40.png?text=${encodeURIComponent(item.name.substring(0,2).toUpperCase())}`; }} />
                          </TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="hidden md:table-cell">{item.sku}</TableCell>
                          <TableCell className="hidden sm:table-cell">{item.unitOfMeasure}</TableCell>
                          <TableCell className="text-right font-semibold">{item.stock}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={item.status === "In Stock" ? "default" : item.status === "Low Stock" ? "secondary" : "destructive"}>{item.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                             <Button variant="outline" size="sm" className="hover:bg-destructive hover:text-destructive-foreground focus-visible:bg-destructive/10 focus-visible:text-destructive" onClick={() => openReportIssueDialog(item)} title={`Report issue with ${item.name}`}>
                                <AlertTriangle className="h-4 w-4 lg:mr-2" /><span className="hidden lg:inline">Report Issue</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile View */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
                  {productsList.map((item) => (
                    <Card key={item.id + "-stock-mobile"}>
                      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                          <div className="flex-1 space-y-1">
                              <CardTitle className="text-base leading-tight">{item.name}</CardTitle>
                              <CardDescription className="text-xs">SKU: {item.sku}</CardDescription>
                          </div>
                          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 hover:bg-destructive hover:text-destructive-foreground" onClick={() => openReportIssueDialog(item)} title={`Report issue with ${item.name}`}>
                              <AlertTriangle className="h-4 w-4" />
                              <span className="sr-only">Report Issue</span>
                          </Button>
                      </CardHeader>
                      <CardContent className="text-sm pt-2">
                          <div className="flex justify-between items-center font-semibold text-lg">
                              <span>Stock:</span>
                              <span>{item.stock} {item.unitOfMeasure}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground">Status:</span>
                              <Badge variant={item.status === "In Stock" ? "default" : item.status === "Low Stock" ? "secondary" : "destructive"}>{item.status}</Badge>
                          </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
