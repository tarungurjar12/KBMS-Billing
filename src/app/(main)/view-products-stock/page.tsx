
"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageSearch, AlertTriangle, Info } from "lucide-react"; // Added Info icon
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
// Future: Import Firebase functions for Firestore operations
// import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
// import { db, auth } from '@/lib/firebase/firebaseConfig';

/**
 * @fileOverview Page for Store Managers to view product prices and stock levels.
 * This page provides read-only access to product information.
 * Managers can report issues with product details, price, or stock to the Admin.
 */

interface ProductInfo {
  id: string; // Product ID
  name: string;
  sku: string;
  price: string; // Formatted display price
  stock: number;
  category: string;
  imageUrl: string;
  dataAiHint: string;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  unitOfMeasure: string;
  // Future: description, hsnCode
}

// Initial dummy data. This will be replaced by Firestore data in Phase 2.
const initialProducts: ProductInfo[] = [
  { id: "PROD-LOCAL-001", name: "Premium Widget", sku: "PW-001", price: "₹2,080.00", stock: 150, category: "Widgets", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "gadget tool", status: "In Stock", unitOfMeasure: "pcs" },
  { id: "PROD-LOCAL-002", name: "Standard Gizmo", sku: "SG-002", price: "₹1,240.00", stock: 25, category: "Gizmos", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "device item", status: "Low Stock", unitOfMeasure: "pcs" },
  { id: "PROD-LOCAL-003", name: "Luxury Doodad", sku: "LD-003", price: "₹3,995.00", stock: 0, category: "Doodads", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "object thing", status: "Out of Stock", unitOfMeasure: "box" },
  { id: "PROD-LOCAL-004", name: "Basic Thingamajig", sku: "BT-004", price: "₹800.00", stock: 500, category: "Thingamajigs", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "item gadget", status: "In Stock", unitOfMeasure: "pcs" },
];

// Zod schema for the issue report form
const issueReportSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  issueDescription: z.string().min(10, { message: "Please provide a detailed description (at least 10 characters)." }),
});

type IssueReportFormValues = z.infer<typeof issueReportSchema>;

const LOW_STOCK_THRESHOLD = 50; // Example, could be per-product in future

/**
 * ViewProductsStockPage component.
 * Allows Store Managers to view product and stock information and report issues.
 */
export default function ViewProductsStockPage() {
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReportIssueDialogOpen, setIsReportIssueDialogOpen] = useState(false);
  const [productToReport, setProductToReport] = useState<ProductInfo | null>(null);
  const { toast } = useToast();

  const form = useForm<IssueReportFormValues>({
    resolver: zodResolver(issueReportSchema),
    defaultValues: {
      productId: "",
      productName: "",
      issueDescription: "",
    },
  });

  /**
   * Formats a number as an Indian Rupee string.
   */
  const formatCurrency = (num: number) => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /**
   * Determines stock status based on quantity.
   */
  const getStatus = (stock: number): ProductInfo['status'] => {
    if (stock <= 0) return "Out of Stock";
    if (stock < LOW_STOCK_THRESHOLD) return "Low Stock"; // Use a defined threshold
    return "In Stock";
  };

  // Effect to load products (currently from initial data, future from Firestore)
  useEffect(() => {
    // Future: Fetch products from Firestore
    // const fetchProducts = async () => {
    //   setIsLoading(true);
    //   try {
    //     const querySnapshot = await getDocs(collection(db, "products"));
    //     const fetchedProducts = querySnapshot.docs.map(doc => {
    //       const data = doc.data();
    //       return {
    //         id: doc.id,
    //         name: data.name,
    //         sku: data.sku,
    //         price: formatCurrency(data.numericPrice), // Format price for display
    //         stock: data.stock,
    //         category: data.category,
    //         imageUrl: data.imageUrl || "https://placehold.co/40x40.png",
    //         dataAiHint: data.dataAiHint || "product",
    //         status: getStatus(data.stock),
    //         unitOfMeasure: data.unitOfMeasure,
    //       } as ProductInfo;
    //     });
    //     setProducts(fetchedProducts);
    //   } catch (error) {
    //     console.error("Error fetching products: ", error);
    //     toast({ title: "Error", description: "Could not load product data.", variant: "destructive" });
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    // fetchProducts();

    // Phase 1: Use local data
    setProducts(initialProducts.map(p => ({...p, status: getStatus(p.stock)})));
    setIsLoading(false);
  }, [toast]);

  /**
   * Opens the "Report Issue" dialog and pre-fills product information.
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
   * Handles submission of the product issue report.
   * Phase 1: Simulates report submission.
   * Future: Saves the report to a 'issueReports' collection in Firestore.
   */
  const handleReportIssueSubmit = (values: IssueReportFormValues) => {
    // const currentUser = auth.currentUser;
    // if (!currentUser) {
    //   toast({ title: "Authentication Error", description: "You must be logged in to report an issue.", variant: "destructive" });
    //   return;
    // }

    // Future: Firebase integration
    // try {
    //   await addDoc(collection(db, "issueReports"), {
    //     ...values,
    //     reportedBy: currentUser.uid, // Store manager's auth UID
    //     reportedAt: serverTimestamp(),
    //     status: "New", // Initial status of the report
    //   });
    //   toast({
    //     title: "Issue Reported",
    //     description: `Thank you! Your report for ${values.productName} has been sent to the Admin.`,
    //   });
    // } catch (error) {
    //   console.error("Error submitting issue report: ", error);
    //   toast({ title: "Error", description: "Failed to submit issue report.", variant: "destructive" });
    //   return;
    // }
    
    // Phase 1: Simulate report submission
    console.log("Issue Reported (Simulated):", values);
    toast({
      title: "Issue Reported to Admin (Simulated)",
      description: `Report for "${values.productName}": ${values.issueDescription}`,
    });
    setIsReportIssueDialogOpen(false);
    setProductToReport(null);
    form.reset();
  };

  if (isLoading) {
    return <PageHeader title="View Products & Stock" description="Loading product data..." icon={PackageSearch} />;
  }

  return (
    <>
      <PageHeader
        title="View Products & Stock"
        description="Check product prices and current stock levels (Read-Only). Report any issues to Admin."
        icon={PackageSearch}
      />

      {/* Report Issue Dialog */}
      <Dialog open={isReportIssueDialogOpen} onOpenChange={(isOpen) => {
          setIsReportIssueDialogOpen(isOpen);
          if (!isOpen) { setProductToReport(null); form.reset(); }
        }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Report Issue for &quot;{productToReport?.name}&quot;</DialogTitle>
            <DialogDescription>
              Spotted an error in product details, price, or stock for SKU: {productToReport?.sku}? Let the Admin know.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleReportIssueSubmit)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="issueDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Describe the Issue</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., The price shown is incorrect, or stock level seems wrong compared to physical count." {...field} rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                 <DialogClose asChild><Button type="button" variant="outline" onClick={() => { setIsReportIssueDialogOpen(false); setProductToReport(null); form.reset();}}>Cancel</Button></DialogClose>
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
            <CardHeader>
              <CardTitle className="font-headline text-foreground">Product Price List</CardTitle>
              <CardDescription>Complete list of products and their current selling prices.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Image</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id + "-price"}>
                      <TableCell>
                        <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md object-cover" data-ai-hint={product.dataAiHint} />
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>{product.unitOfMeasure}</TableCell>
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
               {products.length === 0 && !isLoading && (
                <div className="text-center py-8 text-muted-foreground">No products found.</div>
               )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="stock_list">
          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-foreground">Current Stock Levels</CardTitle>
              <CardDescription>View current inventory status for all products.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Image</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((item) => (
                    <TableRow key={item.id + "-stock"}>
                      <TableCell>
                        <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="rounded-md object-cover" data-ai-hint={item.dataAiHint} />
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>{item.unitOfMeasure}</TableCell>
                      <TableCell className="text-right font-semibold">{item.stock}</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={item.status === "In Stock" ? "default" : item.status === "Low Stock" ? "secondary" : "destructive"}
                           className={
                            item.status === "In Stock" ? "bg-accent text-accent-foreground" : 
                            item.status === "Low Stock" ? "bg-yellow-400 text-yellow-900 dark:bg-yellow-600 dark:text-yellow-100" : 
                            "" // destructive variant handles out of stock
                          }
                        >
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
              {products.length === 0 && !isLoading && (
                <div className="text-center py-8 text-muted-foreground">No products found.</div>
               )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* 
        Phase 1 Data Storage: Product data is local. Issue reports are simulated.
        Phase 2 (Future-Ready):
        - Product and stock data will be fetched from the 'products' collection in Firebase Firestore.
        - This page provides a read-only view. Edits are done by Admins on the '/products' or '/stock' pages.
        - "Report Issue" action would:
          1. Create a new document in an 'issueReports' collection in Firestore.
          2. Store productId, productName, issueDescription, reportedBy (manager UID), reportedAt (serverTimestamp), status ('New').
          3. Admins would have a separate interface (or notifications) to review and address these reports.
      */}
    </>
  );
}
