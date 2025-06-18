
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Boxes, PackageSearch, Edit, Info, FileWarning } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, doc, updateDoc, query, orderBy, serverTimestamp, addDoc, Timestamp, runTransaction } from 'firebase/firestore';
import type { DocumentReference, DocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
import type { Product } from './../products/page';

/**
 * @fileOverview Page for Admin to manage Inventory Levels using Firestore.
 * Allows Admin to:
 *  - View current stock levels for all products from the 'products' collection.
 *  - Manually update stock quantities for products (e.g., after a stock take, for damaged goods, or initial setup).
 *  - Stock is primarily adjusted automatically via Bill Creation and Ledger entries. This page is for manual overrides/corrections.
 *  - All manual stock adjustments are logged in a 'stockMovements' collection for traceability.
 * Data is fetched from and saved to Firebase Firestore.
 */

export interface StockItem extends Product {
  status: "In Stock" | "Low Stock" | "Out of Stock";
}

const stockUpdateSchema = z.object({
  productId: z.string({required_error: "Product ID is required."}).min(1, {message: "Product ID cannot be empty."}),
  currentStock: z.number(),
  adjustmentType: z.enum(["set", "add", "subtract"]).default("set"),
  adjustmentValue: z.preprocess(
    (val) => parseInt(String(val), 10),
    z.number({invalid_type_error: "Adjustment value must be a whole number."}).int()
  ),
  notes: z.string().min(5, {message: "Please provide a brief reason for this stock adjustment (min 5 characters)."})
}).refine(data => {
    if (data.adjustmentType === "subtract") {
        return data.adjustmentValue <= data.currentStock && data.adjustmentValue > 0;
    }
    if (data.adjustmentType === "set") {
        return data.adjustmentValue >= 0;
    }
    if (data.adjustmentType === "add") {
        return data.adjustmentValue > 0;
    }
    return true;
}, {
    message: "Invalid adjustment: 'Subtract' must be positive and not exceed current stock. 'Set' cannot be negative. 'Add' must be positive.",
    path: ["adjustmentValue"],
});

type StockUpdateFormValues = z.infer<typeof stockUpdateSchema>;

const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const LOW_STOCK_THRESHOLD = 50;

export default function StockPage() {
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdateStockDialogOpen, setIsUpdateStockDialogOpen] = useState(false);
  const [productToUpdateStock, setProductToUpdateStock] = useState<StockItem | null>(null);
  const { toast } = useToast();

  const form = useForm<StockUpdateFormValues>({
    resolver: zodResolver(stockUpdateSchema),
    defaultValues: { productId: "", currentStock: 0, adjustmentType: "set", adjustmentValue: 0, notes: "" },
  });

  const getStatus = useCallback((stock: number): StockItem['status'] => {
    if (stock <= 0) return "Out of Stock";
    if (stock < LOW_STOCK_THRESHOLD) return "Low Stock";
    return "In Stock";
  }, []);

  const fetchStock = useCallback(async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "products"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedStockItems = querySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id, name: data.name, sku: data.sku,
          stock: data.stock || 0, status: getStatus(data.stock || 0),
          imageUrl: data.imageUrl || `https://placehold.co/40x40.png?text=${encodeURIComponent(data.name.substring(0,2).toUpperCase())}`,
          dataAiHint: data.dataAiHint || "product item",
          unitOfMeasure: data.unitOfMeasure || "pcs",
          numericPrice: data.numericPrice || 0, price: formatCurrency(data.numericPrice || 0),
          category: data.category || "Other", description: data.description || "",
        } as StockItem;
      });
      setStockList(fetchedStockItems);
    } catch (error: any) {
      console.error("Error fetching stock: ", error);
      if (error.code === 'failed-precondition') {
         toast({
            title: "Database Index Required",
            description: `A query for products (stock) failed. Please create the required Firestore index for 'products' collection (orderBy 'name' ascending). Check your browser's developer console for a Firebase link to create it.`,
            variant: "destructive", duration: 15000,
        });
      } else {
        toast({ title: "Database Error", description: "Could not load stock data. Please try again.", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast, getStatus]);

  useEffect(() => { fetchStock(); }, [fetchStock]);

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
        productId: item.id, currentStock: item.stock,
        adjustmentType: "set", adjustmentValue: item.stock, notes: "",
    });
    setIsUpdateStockDialogOpen(true);
  };

  const handleUpdateStockSubmit = async (values: StockUpdateFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        toast({ title: "Authentication Error", description: "You must be logged in to update stock.", variant: "destructive"});
        return;
    }

    if (!productToUpdateStock || productToUpdateStock.id !== values.productId) {
        toast({ title: "Data Error", description: "Product information mismatch. Please try again.", variant: "destructive"});
        return;
    }

    const originalStock = productToUpdateStock.stock;
    const productName = productToUpdateStock.name;
    const productSku = productToUpdateStock.sku;

    let finalStock: number;
    if (values.adjustmentType === "set") {
        finalStock = values.adjustmentValue;
    } else if (values.adjustmentType === "add") {
        finalStock = originalStock + values.adjustmentValue;
    } else { 
        finalStock = originalStock - values.adjustmentValue;
    }
    if (finalStock < 0) finalStock = 0;

    try {
      if (!db) {
        throw new Error("Firestore database instance is not available.");
      }

      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, "products", values.productId);
        if (!productRef || !productRef.firestore) { 
            console.error("CRITICAL: Invalid productRef in transaction for productId:", values.productId, productRef);
            throw new Error(`Critical: Invalid Product Reference for ID "${values.productId}" in transaction.`);
        }
        
        transaction.update(productRef, {
          stock: finalStock,
          updatedAt: serverTimestamp(),
        });

        const stockMovementLogRef = doc(collection(db, "stockMovements"));
        transaction.set(stockMovementLogRef, {
          productId: values.productId,
          productName: productName,
          sku: productSku,
          previousStock: originalStock,
          newStock: finalStock,
          adjustmentType: values.adjustmentType,
          adjustmentValue: values.adjustmentValue,
          notes: values.notes || "Manual stock adjustment",
          timestamp: serverTimestamp(),
          adjustedByUid: currentUser.uid,
          adjustedByEmail: currentUser.email || "N/A",
        });
      });

      toast({ title: "Stock Updated Successfully", description: `Stock for ${productName} updated to ${finalStock}. Log entry created.` });
      fetchStock();
      setIsUpdateStockDialogOpen(false);
      setProductToUpdateStock(null);
      form.reset();
    } catch (error: any) {
      console.error("Error updating stock: ", error);
      toast({ title: "Stock Update Failed", description: `Failed to update stock: ${error.message || "Please try again."}`, variant: "destructive" });
    }
  };

  if (isLoading && stockList.length === 0) {
    return <PageHeader title="Inventory Levels" description="Loading inventory data from database..." icon={Boxes} />;
  }

  return (
    <>
      <PageHeader title="Inventory Levels" description="View and manually adjust current inventory. (Admin Only)" icon={Boxes} />

      <Card className="mb-6 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 shadow-md">
        <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-amber-700 dark:text-amber-300 flex items-center text-lg">
                <Info className="mr-2 h-5 w-5 shrink-0"/> Manual Stock Adjustments
            </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-600 dark:text-amber-400 pb-4">
            <p>This page is for manual stock corrections (e.g., after stock takes, for damaged goods, or initial setup). </p>
            <p className="mt-1">Routine stock changes due to sales or purchases should be handled through the 'Create Bill' or 'Ledger' pages to ensure data integrity.</p>
        </CardContent>
      </Card>

      <Dialog open={isUpdateStockDialogOpen} onOpenChange={(isOpen) => {
          if(!isOpen) { setIsUpdateStockDialogOpen(false); setProductToUpdateStock(null); form.reset(); }
          else { setIsUpdateStockDialogOpen(isOpen); }
      }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Update Stock for &quot;{productToUpdateStock?.name}&quot;</DialogTitle>
            <DialogDescription>
              SKU: {productToUpdateStock?.sku} | Current Stock: {productToUpdateStock?.stock} {productToUpdateStock?.unitOfMeasure || 'units'}.
              All manual adjustments are logged.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateStockSubmit)} className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-4">
              <FormField control={form.control} name="adjustmentType" render={({ field }) => (
                  <FormItem className="space-y-1"><FormLabel>Adjustment Type</FormLabel>
                    <FormControl><div className="flex flex-col sm:flex-row gap-2 pt-1">
                       <Button type="button" size="sm" variant={field.value === 'set' ? 'default' : 'outline'} onClick={() => { field.onChange('set'); form.setValue('adjustmentValue', productToUpdateStock?.stock || 0);}} className="w-full sm:w-auto">Set New Total</Button>
                       <Button type="button" size="sm" variant={field.value === 'add' ? 'default' : 'outline'} onClick={() => { field.onChange('add'); form.setValue('adjustmentValue', 0);}} className="w-full sm:w-auto">Add to Stock</Button>
                       <Button type="button" size="sm" variant={field.value === 'subtract' ? 'default' : 'outline'} onClick={() => { field.onChange('subtract'); form.setValue('adjustmentValue', 0);}} className="w-full sm:w-auto">Subtract from Stock</Button>
                    </div></FormControl><FormMessage />
                  </FormItem>)} />
               <FormField control={form.control} name="adjustmentValue" render={({ field }) => (
                    <FormItem><FormLabel>{form.watch("adjustmentType") === 'set' ? 'New Total Stock Quantity' : `Quantity to ${form.watch("adjustmentType")}`}</FormLabel>
                      <FormControl><Input type="number" placeholder={form.watch("adjustmentType") === 'set' ? (productToUpdateStock?.stock.toString() || "e.g.,100") : "e.g., 10"} {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl>
                      <FormMessage />
                    </FormItem>)} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Reason/Notes for Adjustment</FormLabel>
                        <FormControl><Input placeholder="e.g., Stock take correction, Damaged goods returned" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>)} />
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 border-t -mx-6 px-6 flex flex-col sm:flex-row gap-2">
                 <DialogClose asChild><Button type="button" variant="outline" className="w-full sm:w-auto">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
                  {form.formState.isSubmitting ? "Updating Stock..." : "Confirm Stock Update"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div><CardTitle className="font-headline text-foreground">Current Stock Levels</CardTitle><CardDescription>Real-time inventory status from Firestore.</CardDescription></div>
            <div className="relative w-full sm:w-64">
              <PackageSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input type="search" placeholder="Search by name or SKU..." className="pl-8 h-10" onChange={handleSearchChange} value={searchTerm}/>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && filteredStockItems.length === 0 && !searchTerm ? (
             <div className="text-center py-10 text-muted-foreground">Loading stock levels...</div>
          ) : !isLoading && filteredStockItems.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-10 text-center">
                <FileWarning className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
                <p className="text-lg sm:text-xl font-semibold text-muted-foreground">No Products Found</p>
                <p className="text-xs sm:text-sm text-muted-foreground mb-6">
                    {searchTerm ? `No products found matching "${searchTerm}".` : "The product database appears to be empty."}
                </p>
             </div>
           ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                  <TableHead className="w-[40px] sm:w-[60px]">Image</TableHead><TableHead>Product Name</TableHead>
                  <TableHead className="hidden md:table-cell">SKU</TableHead><TableHead className="hidden lg:table-cell">Unit</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead><TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredStockItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Image
                          src={item.imageUrl} alt={item.name} width={40} height={40}
                          className="rounded-md object-cover border" data-ai-hint={item.dataAiHint}
                          onError={(e) => { e.currentTarget.src = `https://placehold.co/40x40.png?text=${encodeURIComponent(item.name.substring(0,2).toUpperCase())}`; }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="hidden md:table-cell">{item.sku}</TableCell>
                    <TableCell className="hidden lg:table-cell">{item.unitOfMeasure || 'N/A'}</TableCell>
                    <TableCell className="text-right font-semibold">{item.stock}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={item.status === "In Stock" ? "default" : item.status === "Low Stock" ? "secondary" : "destructive"}
                        className={
                          item.status === "In Stock" ? "bg-accent text-accent-foreground" :
                          item.status === "Low Stock" ? "bg-yellow-400 text-yellow-900 dark:bg-yellow-600 dark:text-yellow-100 border-yellow-500" : ""
                        }
                      >{item.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openUpdateStockDialog(item)}>
                          <Edit className="mr-2 h-3 w-3" />Update Stock
                      </Button>
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
