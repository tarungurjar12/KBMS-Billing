
"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageSearch, AlertTriangle } from "lucide-react";
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
import type { Product } from './../products/page'; // Re-using Product interface

/**
 * @fileOverview Page for Store Managers to view product prices and stock levels from Firestore.
 * This page provides read-only access to product information.
 * Managers can report issues with product details, price, or stock to the Admin.
 */

export interface ProductInfo extends Product { // Extends Product, adding status
  status: "In Stock" | "Low Stock" | "Out of Stock";
}

// Zod schema for the issue report form
const issueReportSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  issueDescription: z.string().min(10, { message: "Please provide a detailed description (at least 10 characters)." }),
});

type IssueReportFormValues = z.infer<typeof issueReportSchema>;

const LOW_STOCK_THRESHOLD = 50; // Example, could be per-product in future or from app settings

/**
 * Formats a number as an Indian Rupee string.
 * @param {number} num - The number to format.
 * @returns {string} A string representing the currency.
 */
const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * ViewProductsStockPage component.
 * Allows Store Managers to view product and stock information from Firestore and report issues.
 * @returns {JSX.Element} The rendered view products/stock page.
 */
export default function ViewProductsStockPage() {
  const [products, setProducts] = useState<ProductInfo[]>([]);
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
  }, [LOW_STOCK_THRESHOLD]); // Add dependency if threshold becomes dynamic

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "products"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedProducts = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          name: data.name,
          sku: data.sku,
          price: formatCurrency(data.numericPrice || 0),
          numericPrice: data.numericPrice || 0,
          stock: data.stock || 0,
          category: data.category || "Other",
          imageUrl: data.imageUrl || `https://placehold.co/40x40.png?text=${data.name.substring(0,2)}`,
          dataAiHint: data.dataAiHint || "product item",
          status: getStatus(data.stock || 0),
          unitOfMeasure: data.unitOfMeasure || "pcs",
        } as ProductInfo;
      });
      setProducts(fetchedProducts);
    } catch (error) {
      console.error("Error fetching products: ", error);
      toast({ title: "Error", description: "Could not load product data from database.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, getStatus]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const openReportIssueDialog = (product: ProductInfo) => {
    setProductToReport(product);
    form.reset({ productId: product.id, productName: product.name, issueDescription: "" });
    setIsReportIssueDialogOpen(true);
  };

  const handleReportIssueSubmit = async (values: IssueReportFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast({ title: "Authentication Error", description: "You must be logged in to report an issue.", variant: "destructive" });
      return;
    }
    try {
      await addDoc(collection(db, "issueReports"), {
        ...values,
        reportedByUid: currentUser.uid,
        reportedByEmail: currentUser.email,
        reportedAt: serverTimestamp(),
        status: "New", // Initial status of the report (e.g., New, Investigating, Resolved)
      });
      toast({ title: "Issue Reported", description: `Thank you! Your report for ${values.productName} has been sent to the Admin.` });
      setIsReportIssueDialogOpen(false);
      setProductToReport(null);
      form.reset();
    } catch (error) {
      console.error("Error submitting issue report: ", error);
      toast({ title: "Error", description: "Failed to submit issue report to database.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <PageHeader title="View Products & Stock" description="Loading product data from database..." icon={PackageSearch} />;
  }

  return (
    <>
      <PageHeader
        title="View Products & Stock"
        description="Check product prices and current stock levels (Read-Only). Report any issues to Admin."
        icon={PackageSearch}
      />

      <Dialog open={isReportIssueDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) { setProductToReport(null); form.reset(); } setIsReportIssueDialogOpen(isOpen);}}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Report Issue for &quot;{productToReport?.name}&quot;</DialogTitle>
            <DialogDescription>Spotted an error in product details, price, or stock for SKU: {productToReport?.sku}? Let the Admin know.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleReportIssueSubmit)} className="space-y-4 py-2">
              <FormField control={form.control} name="issueDescription" render={({ field }) => (
                  <FormItem><FormLabel>Describe the Issue</FormLabel>
                    <FormControl><Textarea placeholder="e.g., The price shown is incorrect, or stock level seems wrong..." {...field} rows={4} /></FormControl>
                    <FormMessage />
                  </FormItem>)} />
              <DialogFooter className="pt-4">
                 <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit">Submit Report</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="price_list" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-[400px] mb-4">
          <TabsTrigger value="price_list">Product Price List</TabsTrigger>
          <TabsTrigger value="stock_list">Current Stock Levels</TabsTrigger>
        </TabsList>
        <TabsContent value="price_list">
          <Card className="shadow-lg rounded-xl">
            <CardHeader><CardTitle className="font-headline text-foreground">Product Price List</CardTitle><CardDescription>Complete list of products and their current selling prices.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                    <TableHead className="w-[80px]">Image</TableHead><TableHead>Product Name</TableHead>
                    <TableHead>SKU</TableHead><TableHead>Category</TableHead><TableHead>Unit</TableHead>
                    <TableHead className="text-right">Price</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id + "-price"}>
                      <TableCell><Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md object-cover" data-ai-hint={product.dataAiHint} /></TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell><TableCell>{product.sku}</TableCell>
                      <TableCell>{product.category}</TableCell><TableCell>{product.unitOfMeasure}</TableCell>
                      <TableCell className="text-right font-semibold">{product.price}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openReportIssueDialog(product)} title={`Report issue with ${product.name}`}>
                            <AlertTriangle className="mr-2 h-4 w-4" /> Report Issue
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
               {products.length === 0 && !isLoading && (<div className="text-center py-8 text-muted-foreground">No products found.</div>)}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="stock_list">
          <Card className="shadow-lg rounded-xl">
            <CardHeader><CardTitle className="font-headline text-foreground">Current Stock Levels</CardTitle><CardDescription>View current inventory status for all products.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                    <TableHead className="w-[80px]">Image</TableHead><TableHead>Product Name</TableHead>
                    <TableHead>SKU</TableHead><TableHead>Unit</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead><TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {products.map((item) => (
                    <TableRow key={item.id + "-stock"}>
                      <TableCell><Image src={item.imageUrl} alt={item.name} width={40} height={40} className="rounded-md object-cover" data-ai-hint={item.dataAiHint} /></TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell><TableCell>{item.sku}</TableCell>
                      <TableCell>{item.unitOfMeasure}</TableCell><TableCell className="text-right font-semibold">{item.stock}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={item.status === "In Stock" ? "default" : item.status === "Low Stock" ? "secondary" : "destructive"}
                           className={item.status === "In Stock" ? "bg-accent text-accent-foreground" : item.status === "Low Stock" ? "bg-yellow-400 text-yellow-900 dark:bg-yellow-600 dark:text-yellow-100" : ""}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openReportIssueDialog(item)} title={`Report issue with ${item.name}`}>
                           <AlertTriangle className="mr-2 h-4 w-4" /> Report Issue
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {products.length === 0 && !isLoading && (<div className="text-center py-8 text-muted-foreground">No products found.</div>)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
