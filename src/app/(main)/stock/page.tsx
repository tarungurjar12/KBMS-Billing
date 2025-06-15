
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Boxes, PackageSearch, Edit } from "lucide-react"; // Removed MoreHorizontal
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
// Future: Import Firebase functions for Firestore operations
// import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
// import { db } from '@/lib/firebase/firebaseConfig';

/**
 * @fileOverview Page for Admin to manage Inventory Levels.
 * Allows Admin to:
 *  - View current stock levels for all products.
 *  - Update stock quantities for products (e.g., after a new shipment or stock-take).
 * Stock is automatically deducted when a bill is created (logic in Create Bill page).
 */

interface StockItem {
  id: string; // Product ID (Firestore document ID or local ID)
  name: string;
  sku: string;
  stock: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  imageUrl: string;
  dataAiHint: string;
  unitOfMeasure: string;
  // Future: Add lowStockThreshold, lastStockUpdate date
}

// Initial dummy data. This will be replaced by Firestore data in Phase 2.
// This data should ideally be derived from the Products data.
const initialStockItems: StockItem[] = [
  { id: "PROD-LOCAL-001", name: "Premium Widget", sku: "PW-001", stock: 150, status: "In Stock", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "gadget tool", unitOfMeasure: "pcs" },
  { id: "PROD-LOCAL-002", name: "Standard Gizmo", sku: "SG-002", stock: 25, status: "Low Stock", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "device item", unitOfMeasure: "pcs" },
  { id: "PROD-LOCAL-003", name: "Luxury Doodad", sku: "LD-003", stock: 0, status: "Out of Stock", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "object thing", unitOfMeasure: "box" },
  { id: "PROD-LOCAL-004", name: "Basic Thingamajig", sku: "BT-004", stock: 500, status: "In Stock", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "item gadget", unitOfMeasure: "pcs" },
];

// Zod schema for stock update form validation
const stockUpdateSchema = z.object({
  productId: z.string(), // Hidden field to identify product
  currentStock: z.number(), // For display and calculation reference
  adjustmentType: z.enum(["set", "add", "subtract"]).default("set"),
  adjustmentValue: z.preprocess(
    (val) => parseInt(String(val), 10),
    z.number({invalid_type_error: "Adjustment value must be a whole number."}).int()
  ),
}).refine(data => {
    if (data.adjustmentType === "subtract" && data.adjustmentValue > data.currentStock && data.currentStock >=0) {
        // If subtracting, don't allow adjustment to make stock negative if it wasn't already.
        // If current stock is already negative (data error), allow setting to 0.
        return false; 
    }
    return true;
}, {
    message: "Cannot subtract more than current stock if stock is non-negative.",
    path: ["adjustmentValue"],
}).refine(data => data.adjustmentType !== "set" || data.adjustmentValue >= 0, {
    message: "New total stock cannot be negative.",
    path: ["adjustmentValue"], // When type is 'set', adjustmentValue holds the new total
});


type StockUpdateFormValues = z.infer<typeof stockUpdateSchema>;

/**
 * StockPage component.
 * Provides UI and logic for Admin to view and update product stock levels.
 */
export default function StockPage() {
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdateStockDialogOpen, setIsUpdateStockDialogOpen] = useState(false);
  const [productToUpdateStock, setProductToUpdateStock] = useState<StockItem | null>(null);
  const { toast } = useToast();

  const LOW_STOCK_THRESHOLD = 50; // Example threshold

  const form = useForm<StockUpdateFormValues>({
    resolver: zodResolver(stockUpdateSchema),
    defaultValues: {
      productId: "",
      currentStock: 0,
      adjustmentType: "set",
      adjustmentValue: 0,
    },
  });

  /**
   * Determines the stock status based on quantity and threshold.
   * @param stock - The current stock quantity.
   * @returns The stock status string.
   */
  const getStatus = (stock: number): "In Stock" | "Low Stock" | "Out of Stock" => {
    if (stock <= 0) return "Out of Stock";
    if (stock < LOW_STOCK_THRESHOLD) return "Low Stock";
    return "In Stock";
  };
  
  // Effect to load stock items (currently from initial data, future from Firestore)
  useEffect(() => {
    // Future: Fetch products from Firestore and map to StockItem interface
    // const fetchStock = async () => {
    //   setIsLoading(true);
    //   try {
    //     const querySnapshot = await getDocs(collection(db, "products"));
    //     const fetchedStockItems = querySnapshot.docs.map(doc => {
    //       const data = doc.data();
    //       return {
    //         id: doc.id,
    //         name: data.name,
    //         sku: data.sku,
    //         stock: data.stock,
    //         status: getStatus(data.stock),
    //         imageUrl: data.imageUrl || "https://placehold.co/40x40.png",
    //         dataAiHint: data.dataAiHint || "product",
    //         unitOfMeasure: data.unitOfMeasure || "pcs",
    //       } as StockItem;
    //     });
    //     setStockList(fetchedStockItems);
    //   } catch (error) {
    //     console.error("Error fetching stock: ", error);
    //     toast({ title: "Error", description: "Could not load stock data.", variant: "destructive" });
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    // fetchStock();

    // Phase 1: Use local data
    setStockList(initialStockItems.map(item => ({...item, status: getStatus(item.stock) })));
    setIsLoading(false);
  }, [toast]);


  /**
   * Handles changes in the search input field.
   */
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value.toLowerCase());
  };

  const filteredStockItems = stockList.filter(item =>
    item.name.toLowerCase().includes(searchTerm) ||
    item.sku.toLowerCase().includes(searchTerm)
  );
  
  /**
   * Opens the update stock dialog and populates form with product's current stock.
   */
  const openUpdateStockDialog = (item: StockItem) => {
    setProductToUpdateStock(item);
    form.reset({ 
        productId: item.id,
        currentStock: item.stock, 
        adjustmentType: "set", // Default to setting new total
        adjustmentValue: item.stock, // Pre-fill with current stock for "set" type
    });
    setIsUpdateStockDialogOpen(true);
  };

  /**
   * Handles submission of the stock update form.
   * Phase 1: Updates local state.
   * Future: Updates stock in Firestore for the specific product.
   */
  const handleUpdateStockSubmit = (values: StockUpdateFormValues) => {
    if (!productToUpdateStock) return;

    let finalStock: number;
    if (values.adjustmentType === "set") {
        finalStock = values.adjustmentValue; // Here, adjustmentValue is the new total stock
    } else if (values.adjustmentType === "add") {
        finalStock = productToUpdateStock.stock + values.adjustmentValue;
    } else { // subtract
        finalStock = productToUpdateStock.stock - values.adjustmentValue;
    }
    // Ensure stock doesn't go below zero from adjustment
    if (finalStock < 0) finalStock = 0;


    // Future: Firebase integration
    // try {
    //   const productRef = doc(db, "products", productToUpdateStock.id);
    //   await updateDoc(productRef, { stock: finalStock });
    //   setStockList((prev) =>
    //     prev.map((p) =>
    //       p.id === productToUpdateStock.id ? { ...p, stock: finalStock, status: getStatus(finalStock) } : p
    //     )
    //   );
    //   toast({
    //     title: "Stock Updated",
    //     description: `Stock for ${productToUpdateStock.name} updated to ${finalStock}.`,
    //   });
    // } catch (error) {
    //   console.error("Error updating stock: ", error);
    //   toast({ title: "Error", description: "Failed to update stock.", variant: "destructive" });
    //   return;
    // }

    // Phase 1: Local state update
    setStockList((prev) =>
      prev.map((p) =>
        p.id === productToUpdateStock.id ? { ...p, stock: finalStock, status: getStatus(finalStock) } : p
      )
    );

    toast({
      title: "Stock Updated (Locally)",
      description: `Stock for ${productToUpdateStock.name} updated to ${finalStock}.`,
    });
    setProductToUpdateStock(null);
    setIsUpdateStockDialogOpen(false);
    form.reset();
  };

  if (isLoading) {
    return <PageHeader title="Inventory Levels" description="Loading inventory data..." icon={Boxes} />;
  }

  return (
    <>
      <PageHeader
        title="Inventory Levels"
        description="View and update current inventory status for all products. (Admin Only)"
        icon={Boxes}
      />

      {/* Update Stock Dialog */}
      <Dialog open={isUpdateStockDialogOpen} onOpenChange={(isOpen) => {
          setIsUpdateStockDialogOpen(isOpen);
          if (!isOpen) setProductToUpdateStock(null); // Clear product if dialog closed
        }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Update Stock for &quot;{productToUpdateStock?.name}&quot;</DialogTitle>
            <DialogDescription>
              SKU: {productToUpdateStock?.sku} | Current Stock: {productToUpdateStock?.stock} {productToUpdateStock?.unitOfMeasure || 'units'}.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateStockSubmit)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="adjustmentType"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel>Adjustment Type</FormLabel>
                    <FormControl>
                        <div className="flex gap-2 pt-1">
                           <Button type="button" size="sm" variant={field.value === 'set' ? 'default' : 'outline'} onClick={() => { field.onChange('set'); form.setValue('adjustmentValue', productToUpdateStock?.stock || 0);}}>Set New Total</Button>
                           <Button type="button" size="sm" variant={field.value === 'add' ? 'default' : 'outline'} onClick={() => { field.onChange('add'); form.setValue('adjustmentValue', 0);}}>Add to Stock</Button>
                           <Button type="button" size="sm" variant={field.value === 'subtract' ? 'default' : 'outline'} onClick={() => { field.onChange('subtract'); form.setValue('adjustmentValue', 0);}}>Subtract</Button>
                        </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                  control={form.control}
                  name="adjustmentValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{form.watch("adjustmentType") === 'set' ? 'New Total Stock Quantity' : `Quantity to ${form.watch("adjustmentType")}`}</FormLabel>
                      <FormControl>
                        <Input 
                            type="number" 
                            placeholder={form.watch("adjustmentType") === 'set' ? (productToUpdateStock?.stock.toString() || "e.g.,100") : "e.g., 10"} 
                            {...field} 
                            onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              <DialogFooter className="pt-4">
                 <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={() => { setIsUpdateStockDialogOpen(false); setProductToUpdateStock(null); }}>
                      Cancel
                    </Button>
                  </DialogClose>
                <Button type="submit">Update Stock</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="font-headline text-foreground">Current Stock Levels</CardTitle>
              <CardDescription>View current inventory status for all products.</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <PackageSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search products by name or SKU..." className="pl-8" onChange={handleSearchChange} />
            </div>
          </div>
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
              {filteredStockItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="rounded-md object-cover" data-ai-hint={item.dataAiHint} />
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.sku}</TableCell>
                  <TableCell>{item.unitOfMeasure || 'N/A'}</TableCell>
                  <TableCell className="text-right">{item.stock}</TableCell>
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
                    <Button variant="outline" size="sm" onClick={() => openUpdateStockDialog(item)}>
                      <Edit className="mr-2 h-4 w-4" /> Update Stock
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           {filteredStockItems.length === 0 && !isLoading && (
             <div className="text-center py-8 text-muted-foreground">
                No products found matching your search.
             </div>
           )}
        </CardContent>
      </Card>
      {/* 
        Phase 1 Data Storage: Stock data is managed as part of the local product list.
        Phase 2 (Future-Ready):
        - Stock levels will be a field within each product document in the 'products' collection in Firebase Firestore.
        - Updating stock here would directly modify the 'stock' field of the corresponding product document.
        - Stock deduction upon bill creation (on Create Bill page) would also update this 'stock' field, ideally within a Firestore transaction to ensure atomicity.
        - Low stock alerts could be implemented using Firebase Functions that trigger when a product's stock drops below its 'lowStockThreshold'.
      */}
    </>
  );
}
