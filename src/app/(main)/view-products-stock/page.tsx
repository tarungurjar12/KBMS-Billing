
"use client";

import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";


interface ProductInfo {
  id: string;
  name: string;
  sku: string;
  price: string;
  stock: number;
  category: string;
  imageUrl: string;
  dataAiHint: string;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  unitOfMeasure: string;
}

const initialProducts: ProductInfo[] = [
  { id: "PROD001", name: "Premium Widget", sku: "PW-001", price: "₹2,080", stock: 150, category: "Widgets", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "gadget tool", status: "In Stock", unitOfMeasure: "pcs" },
  { id: "PROD002", name: "Standard Gizmo", sku: "SG-002", price: "₹1,240", stock: 25, category: "Gizmos", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "device item", status: "Low Stock", unitOfMeasure: "pcs" },
  { id: "PROD003", name: "Luxury Doodad", sku: "LD-003", price: "₹3,995", stock: 0, category: "Doodads", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "object thing", status: "Out of Stock", unitOfMeasure: "box" },
  { id: "PROD004", name: "Basic Thingamajig", sku: "BT-004", price: "₹800", stock: 500, category: "Thingamajigs", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "item gadget", status: "In Stock", unitOfMeasure: "pcs" },
];

const issueReportSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  issueDescription: z.string().min(10, { message: "Please provide a detailed description (at least 10 characters)." }),
});

type IssueReportFormValues = z.infer<typeof issueReportSchema>;


export default function ViewProductsStockPage() {
  const [products, setProducts] = useState<ProductInfo[]>(initialProducts);
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

  // useEffect(() => {
  //   // Placeholder for fetching products from a data source
  //   // async function fetchProducts() {
  //   //   // const fetchedProducts = await db.getProducts(); // Future cloud integration
  //   //   // setProducts(fetchedProducts.map(p => ({...p, status: getStatus(p.stock)})));
  //   // }
  //   // fetchProducts();
  //   // For now, using initialProducts
  //   setProducts(initialProducts.map(p => ({...p, status: getStatus(p.stock)})));
  // }, []);

  const getStatus = (stock: number): "In Stock" | "Low Stock" | "Out of Stock" => {
    if (stock <= 0) return "Out of Stock";
    if (stock < 50) return "Low Stock";
    return "In Stock";
  };

  const openReportIssueDialog = (product: ProductInfo) => {
    setProductToReport(product);
    form.reset({
        productId: product.id,
        productName: product.name,
        issueDescription: ""
    });
    setIsReportIssueDialogOpen(true);
  };

  const handleReportIssueSubmit = (values: IssueReportFormValues) => {
    // For future cloud integration:
    // try {
    //   await api.submitProductIssueReport(values); // Example API call
    //   toast({
    //     title: "Issue Reported",
    //     description: `Thank you! Your report for ${values.productName} has been sent to the Admin.`,
    //   });
    // } catch (error) {
    //   toast({ title: "Error", description: "Failed to submit issue report.", variant: "destructive" });
    //   return;
    // }
    
    console.log("Issue Reported:", values);
    toast({
      title: "Issue Reported to Admin (Simulated)",
      description: `Report for "${values.productName}": ${values.issueDescription}`,
    });
    setIsReportIssueDialogOpen(false);
    setProductToReport(null);
    form.reset();
  };


  return (
    <>
      <PageHeader
        title="View Products & Stock"
        description="Check product prices and current stock levels (Read-Only)."
        icon={PackageSearch}
      />

      {/* Report Issue Dialog */}
      <Dialog open={isReportIssueDialogOpen} onOpenChange={(isOpen) => {
          setIsReportIssueDialogOpen(isOpen);
          if (!isOpen) setProductToReport(null);
        }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Report Issue for &quot;{productToReport?.name}&quot;</DialogTitle>
            <DialogDescription>
              Spotted an error in product details, price, or stock? Let the Admin know.
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
                      <Textarea placeholder="e.g., The price shown is incorrect, or stock level seems wrong." {...field} rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                 <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={() => { setIsReportIssueDialogOpen(false); setProductToReport(null); }}>
                      Cancel
                    </Button>
                  </DialogClose>
                <Button type="submit">Submit Report</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>


      <Tabs defaultValue="price_list" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-[400px] mb-4">
          <TabsTrigger value="price_list">Price List</TabsTrigger>
          <TabsTrigger value="stock_list">Stock List</TabsTrigger>
        </TabsList>
        <TabsContent value="price_list">
          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-foreground">Product Price List</CardTitle>
              <CardDescription>Complete list of products and their selling prices.</CardDescription>
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
                        <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md" data-ai-hint={product.dataAiHint} />
                      </TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.sku}</TableCell>
                      <TableCell>{product.category}</TableCell>
                      <TableCell>{product.unitOfMeasure}</TableCell>
                      <TableCell className="text-right font-semibold">{product.price}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openReportIssueDialog(product)}>
                            <AlertTriangle className="mr-2 h-4 w-4" /> Report Issue
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                        <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="rounded-md" data-ai-hint={item.dataAiHint} />
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
                            "" /* destructive variant handles out of stock */
                          }
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openReportIssueDialog(item)}>
                           <AlertTriangle className="mr-2 h-4 w-4" /> Report Issue
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {/* Comment for future data persistence:
          The 'products' state is currently managed locally with dummy data.
          In a production environment with cloud integration (e.g., Firebase Firestore):
          - Products with their prices and real-time stock would be fetched from the database.
          - "Report Issue" would submit data to a specific collection or trigger a notification system for admins.
          - Example: `await firestore.collection('issueReports').add(reportData);`
      */}
    </>
  );
}

    