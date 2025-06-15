
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Boxes, PackageSearch, Edit } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, doc, updateDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import type { Product } from './../products/page'; // Re-using Product interface

/**
 * @fileOverview Page for Admin to manage Inventory Levels using Firestore.
 * Allows Admin to:
 *  - View current stock levels for all products from the 'products' collection.
 *  - Update stock quantities for products.
 * Stock is automatically deducted when a bill is created (logic in Create Bill page).
 */

export interface StockItem extends Product { // Extends Product, adding status
  status: "In Stock" | "Low Stock" | "Out of Stock";
}

// Zod schema for stock update form validation
const stockUpdateSchema = z.object({
  productId: z.string(),
  currentStock: z.number(),
  adjustmentType: z.enum(["set", "add", "subtract"]).default("set"),
  adjustmentValue: z.preprocess(
    (val) => parseInt(String(val), 10),
    z.number({invalid_type_error: "Adjustment value must be a whole number."}).int()
  ),
  notes: z.string().optional(), // For stock adjustment log
}).refine(data => {
    if (data.adjustmentType === "subtract" && data.adjustmentValue > data.currentStock && data.currentStock >=0) {
        return false; 
    }
    return true;
}, {
    message: "Cannot subtract more than current stock if stock is non-negative.",
    path: ["adjustmentValue"],
}).refine(data => data.adjustmentType !== "set" || data.adjustmentValue >= 0, {
    message: "New total stock cannot be negative.",
    path: ["adjustmentValue"],
});

type StockUpdateFormValues = z.infer<typeof stockUpdateSchema>;

/**
 * Formats a number as an Indian Rupee string for display (though not directly used here).
 * @param {number} num - The number to format.
 * @returns {string} A string representing the currency.
 */
const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * StockPage component.
 * Provides UI and logic for Admin to view and update product stock levels from Firestore.
 * @returns {JSX.Element} The rendered stock page.
 */
export default function StockPage() {
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdateStockDialogOpen, setIsUpdateStockDialogOpen] = useState(false);
  const [productToUpdateStock, setProductToUpdateStock] = useState<StockItem | null>(null);
  const { toast } = useToast();

  const LOW_STOCK_THRESHOLD = 50; // Example global threshold. Future: per-product threshold.

  const form = useForm<StockUpdateFormValues>({
    resolver: zodResolver(stockUpdateSchema),
    defaultValues: { productId: "", currentStock: 0, adjustmentType: "set", adjustmentValue: 0, notes: "" },
  });

  const getStatus = useCallback((stock: number): StockItem['status'] => {
    if (stock <= 0) return "Out of Stock";
    if (stock < LOW_STOCK_THRESHOLD) return "Low Stock";
    return "In Stock";
  }, [LOW_STOCK_THRESHOLD]); // Add LOW_STOCK_THRESHOLD to dependencies if it becomes dynamic
  
  const fetchStock = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "products"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedStockItems = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          name: data.name,
          sku: data.sku,
          stock: data.stock || 0,
          status: getStatus(data.stock || 0),
          imageUrl: data.imageUrl || `https://placehold.co/40x40.png?text=${data.name.substring(0,2)}`,
          dataAiHint: data.dataAiHint || "product item",
          unitOfMeasure: data.unitOfMeasure || "pcs",
          numericPrice: data.numericPrice || 0,
          price: formatCurrency(data.numericPrice || 0),
          category: data.category || "Other",
        } as StockItem;
      });
      setStockList(fetchedStockItems);
    } catch (error) {
      console.error("Error fetching stock: ", error);
      toast({ title: "Error", description: "Could not load stock data from database.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, getStatus]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value.toLowerCase());
  };

  const filteredStockItems = stockList.filter(item =>
    item.name.toLowerCase().includes(searchTerm) ||
    item.sku.toLowerCase().includes(searchTerm)
  );
  
  const openUpdateStockDialog = (item: StockItem) => {
    setProductToUpdateStock(item);
    form.reset({ 
        productId: item.id,
        currentStock: item.stock, 
        adjustmentType: "set",
        adjustmentValue: item.stock,
        notes: "",
    });
    setIsUpdateStockDialogOpen(true);
  };

  const handleUpdateStockSubmit = async (values: StockUpdateFormValues) => {
    if (!productToUpdateStock) return;
    let finalStock: number;
    if (values.adjustmentType === "set") {
        finalStock = values.adjustmentValue;
    } else if (values.adjustmentType === "add") {
        finalStock = productToUpdateStock.stock + values.adjustmentValue;
    } else { // subtract
        finalStock = productToUpdateStock.stock - values.adjustmentValue;
    }
    if (finalStock < 0 && values.adjustmentType !== "set") finalStock = 0; // Don't allow add/subtract to go negative, set ensures >= 0 by schema

    try {
      const productRef = doc(db, "products", productToUpdateStock.id);
      await updateDoc(productRef, { 
        stock: finalStock,
        // Future: Add a stock movement log entry
        // lastStockUpdate: serverTimestamp(),
        // lastStockUpdateReason: values.notes || `Manual adjustment via ${values.adjustmentType}`
      });
      // Optionally, create a stock log entry
      // await addDoc(collection(db, "stockMovements"), {
      //   productId: productToUpdateStock.id,
      //   productName: productToUpdateStock.name,
      //   previousStock: productToUpdateStock.stock,
      //   newStock: finalStock,
      //   adjustmentType: values.adjustmentType,
      //   adjustmentValue: values.adjustmentValue,
      //   notes: values.notes,
      //   timestamp: serverTimestamp(),
      //   // userId: auth.currentUser?.uid // if applicable
      // });

      toast({ title: "Stock Updated", description: `Stock for ${productToUpdateStock.name} updated to ${finalStock}.` });
      fetchStock(); // Refresh list
      setIsUpdateStockDialogOpen(false);
      setProductToUpdateStock(null);
      form.reset();
    } catch (error) {
      console.error("Error updating stock: ", error);
      toast({ title: "Error", description: "Failed to update stock in database.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <PageHeader title="Inventory Levels" description="Loading inventory data from database..." icon={Boxes} />;
  }

  return (
    <>
      <PageHeader title="Inventory Levels" description="View and update current inventory. (Admin Only)" icon={Boxes} />

      <Dialog open={isUpdateStockDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) { setIsUpdateStockDialogOpen(false); setProductToUpdateStock(null); form.reset();} else {setIsUpdateStockDialogOpen(isOpen);}}}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Update Stock for &quot;{productToUpdateStock?.name}&quot;</DialogTitle>
            <DialogDescription>SKU: {productToUpdateStock?.sku} | Current: {productToUpdateStock?.stock} {productToUpdateStock?.unitOfMeasure || 'units'}.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateStockSubmit)} className="space-y-4 py-2">
              <FormField control={form.control} name="adjustmentType" render={({ field }) => (
                  <FormItem className="space-y-1"><FormLabel>Adjustment Type</FormLabel>
                    <FormControl><div className="flex gap-2 pt-1">
                       <Button type="button" size="sm" variant={field.value === 'set' ? 'default' : 'outline'} onClick={() => { field.onChange('set'); form.setValue('adjustmentValue', productToUpdateStock?.stock || 0);}}>Set New Total</Button>
                       <Button type="button" size="sm" variant={field.value === 'add' ? 'default' : 'outline'} onClick={() => { field.onChange('add'); form.setValue('adjustmentValue', 0);}}>Add to Stock</Button>
                       <Button type="button" size="sm" variant={field.value === 'subtract' ? 'default' : 'outline'} onClick={() => { field.onChange('subtract'); form.setValue('adjustmentValue', 0);}}>Subtract</Button>
                    </div></FormControl><FormMessage />
                  </FormItem>)} />
               <FormField control={form.control} name="adjustmentValue" render={({ field }) => (
                    <FormItem><FormLabel>{form.watch("adjustmentType") === 'set' ? 'New Total Stock' : `Quantity to ${form.watch("adjustmentType")}`}</FormLabel>
                      <FormControl><Input type="number" placeholder={form.watch("adjustmentType") === 'set' ? (productToUpdateStock?.stock.toString() || "e.g.,100") : "e.g., 10"} {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl>
                      <FormMessage />
                    </FormItem>)} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Reason/Notes for Adjustment (Optional)</FormLabel>
                        <FormControl><Input placeholder="e.g., Stock take correction, Damaged goods" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>)} />
              <DialogFooter className="pt-4">
                 <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit">Update Stock</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div><CardTitle className="font-headline text-foreground">Current Stock Levels</CardTitle><CardDescription>Inventory status from Firestore.</CardDescription></div>
            <div className="relative w-full sm:w-64">
              <PackageSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input type="search" placeholder="Search by name or SKU..." className="pl-8" onChange={handleSearchChange} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
                <TableHead className="w-[80px]">Image</TableHead><TableHead>Product Name</TableHead><TableHead>SKU</TableHead>
                <TableHead>Unit</TableHead><TableHead className="text-right">Current Stock</TableHead>
                <TableHead className="text-center">Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredStockItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell><Image src={item.imageUrl} alt={item.name} width={40} height={40} className="rounded-md object-cover" data-ai-hint={item.dataAiHint} /></TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell><TableCell>{item.sku}</TableCell>
                  <TableCell>{item.unitOfMeasure || 'N/A'}</TableCell><TableCell className="text-right">{item.stock}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={item.status === "In Stock" ? "default" : item.status === "Low Stock" ? "secondary" : "destructive"}
                      className={ item.status === "In Stock" ? "bg-accent text-accent-foreground" : item.status === "Low Stock" ? "bg-yellow-400 text-yellow-900 dark:bg-yellow-600 dark:text-yellow-100" : ""}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => openUpdateStockDialog(item)}><Edit className="mr-2 h-4 w-4" />Update Stock</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           {filteredStockItems.length === 0 && !isLoading && (<div className="text-center py-8 text-muted-foreground">No products found.</div>)}
        </CardContent>
      </Card>
    </>
  );
}
