
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Boxes, PackageSearch, Edit, Info } from "lucide-react"; // Added Info icon
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, doc, updateDoc, query, orderBy, serverTimestamp, addDoc, Timestamp } from 'firebase/firestore'; // Added addDoc, serverTimestamp
import { db, auth } from '@/lib/firebase/firebaseConfig'; // Added auth
import type { User as FirebaseUser } from "firebase/auth";
import type { Product } from './../products/page'; // Re-using Product interface

/**
 * @fileOverview Page for Admin to manage Inventory Levels using Firestore.
 * Allows Admin to:
 *  - View current stock levels for all products from the 'products' collection.
 *  - Manually update stock quantities for products (e.g., after a stock take, for damaged goods, or initial setup).
 *  - Stock is primarily adjusted automatically via Bill Creation and Ledger entries. This page is for manual overrides/corrections.
 * Data is fetched from and saved to Firebase Firestore.
 */

/**
 * Interface extending Product for stock-specific display, including stock status.
 */
export interface StockItem extends Product { 
  status: "In Stock" | "Low Stock" | "Out of Stock";
}

// Zod schema for stock update form validation
const stockUpdateSchema = z.object({
  productId: z.string(), // Hidden field, populated programmatically
  currentStock: z.number(), // For display and reference in validation
  adjustmentType: z.enum(["set", "add", "subtract"]).default("set"),
  adjustmentValue: z.preprocess(
    (val) => parseInt(String(val), 10), // Ensure integer parsing
    z.number({invalid_type_error: "Adjustment value must be a whole number."}).int()
  ),
  notes: z.string().min(5, {message: "Please provide a brief reason for this stock adjustment (min 5 characters)."}).optional(), // Make notes required for traceability
}).refine(data => { // Validation for 'subtract' and 'set' types
    if (data.adjustmentType === "subtract") {
        return data.adjustmentValue <= data.currentStock && data.adjustmentValue > 0; // Cannot subtract more than available, must be positive
    }
    if (data.adjustmentType === "set") {
        return data.adjustmentValue >= 0; // New total stock cannot be negative
    }
    if (data.adjustmentType === "add") {
        return data.adjustmentValue > 0; // Must add a positive quantity
    }
    return true;
}, {
    message: "Invalid adjustment: 'Subtract' quantity cannot exceed current stock or be non-positive. 'Set' quantity cannot be negative. 'Add' quantity must be positive.",
    path: ["adjustmentValue"], // Associate error with adjustmentValue field
});

type StockUpdateFormValues = z.infer<typeof stockUpdateSchema>;

/**
 * Formats a number as an Indian Rupee string for display (though not directly used here for price).
 * @param {number} num - The number to format.
 * @returns {string} A string representing the currency.
 */
const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const LOW_STOCK_THRESHOLD = 50; // Example global threshold. Future: per-product threshold from product data.

/**
 * StockPage component.
 * Provides UI and logic for Admin to view and manually update product stock levels in Firestore.
 * Logs stock movements for traceability.
 * @returns {JSX.Element} The rendered stock page.
 */
export default function StockPage() {
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdateStockDialogOpen, setIsUpdateStockDialogOpen] = useState(false);
  const [productToUpdateStock, setProductToUpdateStock] = useState<StockItem | null>(null);
  const { toast } = useToast();

  // React Hook Form setup for the stock update dialog
  const form = useForm<StockUpdateFormValues>({
    resolver: zodResolver(stockUpdateSchema),
    defaultValues: { productId: "", currentStock: 0, adjustmentType: "set", adjustmentValue: 0, notes: "" },
  });

  /**
   * Determines the stock status string based on quantity and threshold.
   * @param {number} stock - The current stock quantity.
   * @returns {StockItem['status']} The stock status string.
   */
  const getStatus = useCallback((stock: number): StockItem['status'] => {
    if (stock <= 0) return "Out of Stock";
    if (stock < LOW_STOCK_THRESHOLD) return "Low Stock"; // Use the defined constant
    return "In Stock";
  }, []); 
  
  /**
   * Fetches product stock data from Firestore's 'products' collection.
   * Orders products by name and calculates stock status.
   */
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
          imageUrl: data.imageUrl || `https://placehold.co/40x40.png?text=${encodeURIComponent(data.name.substring(0,2).toUpperCase())}`,
          dataAiHint: data.dataAiHint || "product item",
          unitOfMeasure: data.unitOfMeasure || "pcs",
          // Include other Product fields for completeness if needed by StockItem interface
          numericPrice: data.numericPrice || 0,
          price: formatCurrency(data.numericPrice || 0),
          category: data.category || "Other",
          description: data.description || "",
        } as StockItem;
      });
      setStockList(fetchedStockItems);
    } catch (error) {
      console.error("Error fetching stock: ", error);
      toast({ title: "Database Error", description: "Could not load stock data. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, getStatus]);

  // Fetch stock data when the component mounts
  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  /**
   * Handles changes in the search input field.
   * @param {React.ChangeEvent<HTMLInputElement>} event - The input change event.
   */
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value.toLowerCase());
  };

  // Filter stock items based on the search term (name or SKU)
  const filteredStockItems = stockList.filter(item =>
    item.name.toLowerCase().includes(searchTerm) ||
    item.sku.toLowerCase().includes(searchTerm)
  );
  
  /**
   * Opens the stock update dialog and pre-fills form with selected product's data.
   * @param {StockItem} item - The stock item to update.
   */
  const openUpdateStockDialog = (item: StockItem) => {
    setProductToUpdateStock(item);
    form.reset({ 
        productId: item.id,
        currentStock: item.stock, 
        adjustmentType: "set", // Default to "set" for clarity
        adjustmentValue: item.stock, // Pre-fill with current stock for "set"
        notes: "",
    });
    setIsUpdateStockDialogOpen(true);
  };

  /**
   * Handles submission of the stock update form.
   * Updates the product's stock in Firestore and creates a stock movement log entry.
   * @param {StockUpdateFormValues} values - The validated form values.
   */
  const handleUpdateStockSubmit = async (values: StockUpdateFormValues) => {
    if (!productToUpdateStock) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
        toast({ title: "Authentication Error", description: "You must be logged in to update stock.", variant: "destructive"});
        return;
    }

    let finalStock: number;
    // Calculate the new stock level based on adjustment type
    if (values.adjustmentType === "set") {
        finalStock = values.adjustmentValue;
    } else if (values.adjustmentType === "add") {
        finalStock = productToUpdateStock.stock + values.adjustmentValue;
    } else { // subtract
        finalStock = productToUpdateStock.stock - values.adjustmentValue;
    }
    // Final check to prevent negative stock from arithmetic error, though Zod schema should catch most.
    if (finalStock < 0) finalStock = 0; 

    try {
      const productRef = doc(db, "products", productToUpdateStock.id);
      
      // Firestore transaction for atomicity (update product stock and add log entry)
      await runTransaction(db, async (transaction) => {
        transaction.update(productRef, { 
          stock: finalStock,
          updatedAt: serverTimestamp(), // Update the product's last modified time
        });

        // Add a stock movement log entry for traceability
        const stockMovementLogRef = collection(db, "stockMovements");
        transaction.set(doc(stockMovementLogRef), {
          productId: productToUpdateStock.id,
          productName: productToUpdateStock.name,
          sku: productToUpdateStock.sku,
          previousStock: productToUpdateStock.stock,
          newStock: finalStock,
          adjustmentType: values.adjustmentType,
          adjustmentValue: values.adjustmentValue,
          notes: values.notes || "Manual stock adjustment", // Default note if none provided
          timestamp: serverTimestamp(),
          adjustedByUid: currentUser.uid,
          adjustedByEmail: currentUser.email,
        });
      });

      toast({ title: "Stock Updated Successfully", description: `Stock for ${productToUpdateStock.name} updated to ${finalStock}. A log entry was created.` });
      fetchStock(); // Refresh the stock list
      setIsUpdateStockDialogOpen(false); // Close the dialog
      setProductToUpdateStock(null);
      form.reset(); // Reset the form
    } catch (error) {
      console.error("Error updating stock: ", error);
      toast({ title: "Stock Update Failed", description: "Failed to update stock in the database. Please try again.", variant: "destructive" });
    }
  };

  // Display loading state
  if (isLoading) {
    return <PageHeader title="Inventory Levels" description="Loading inventory data from database..." icon={Boxes} />;
  }

  return (
    <>
      <PageHeader title="Inventory Levels" description="View and manually adjust current inventory. (Admin Only)" icon={Boxes} />

      {/* Informational Card about manual stock adjustments */}
      <Card className="mb-6 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 shadow-md">
        <CardHeader className="pb-2">
            <CardTitle className="text-amber-700 dark:text-amber-300 flex items-center text-lg">
                <Info className="mr-2 h-5 w-5"/> Manual Stock Adjustments
            </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-600 dark:text-amber-400">
            <p>This page is for manual stock corrections (e.g., after stock takes, for damaged goods, or initial setup). </p>
            <p className="mt-1">Routine stock changes due to sales or purchases should be handled through the 'Create Bill' or 'Ledger' pages to ensure data integrity.</p>
        </CardContent>
      </Card>

      {/* Stock Update Dialog */}
      <Dialog open={isUpdateStockDialogOpen} onOpenChange={(isOpen) => { 
          if(!isOpen) { 
            setIsUpdateStockDialogOpen(false); 
            setProductToUpdateStock(null); 
            form.reset(); // Ensure form reset on close
          } else {
            setIsUpdateStockDialogOpen(isOpen);
          }
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
            <form onSubmit={form.handleSubmit(handleUpdateStockSubmit)} className="space-y-4 py-2">
              {/* Adjustment Type Selection Buttons */}
              <FormField control={form.control} name="adjustmentType" render={({ field }) => (
                  <FormItem className="space-y-1"><FormLabel>Adjustment Type</FormLabel>
                    <FormControl><div className="flex gap-2 pt-1">
                       <Button type="button" size="sm" variant={field.value === 'set' ? 'default' : 'outline'} onClick={() => { field.onChange('set'); form.setValue('adjustmentValue', productToUpdateStock?.stock || 0);}}>Set New Total</Button>
                       <Button type="button" size="sm" variant={field.value === 'add' ? 'default' : 'outline'} onClick={() => { field.onChange('add'); form.setValue('adjustmentValue', 0);}}>Add to Stock</Button>
                       <Button type="button" size="sm" variant={field.value === 'subtract' ? 'default' : 'outline'} onClick={() => { field.onChange('subtract'); form.setValue('adjustmentValue', 0);}}>Subtract from Stock</Button>
                    </div></FormControl><FormMessage />
                  </FormItem>)} />
              {/* Adjustment Value Input */}
               <FormField control={form.control} name="adjustmentValue" render={({ field }) => (
                    <FormItem><FormLabel>{form.watch("adjustmentType") === 'set' ? 'New Total Stock Quantity' : `Quantity to ${form.watch("adjustmentType")}`}</FormLabel>
                      <FormControl><Input type="number" placeholder={form.watch("adjustmentType") === 'set' ? (productToUpdateStock?.stock.toString() || "e.g.,100") : "e.g., 10"} {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl>
                      <FormMessage />
                    </FormItem>)} />
                {/* Notes/Reason for Adjustment */}
                <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Reason/Notes for Adjustment</FormLabel>
                        <FormControl><Input placeholder="e.g., Stock take correction, Damaged goods returned" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>)} />
              <DialogFooter className="pt-4">
                 <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Updating Stock..." : "Confirm Stock Update"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Stock List Table */}
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div><CardTitle className="font-headline text-foreground">Current Stock Levels</CardTitle><CardDescription>Real-time inventory status from Firestore.</CardDescription></div>
            <div className="relative w-full sm:w-64">
              <PackageSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input type="search" placeholder="Search by name or SKU..." className="pl-8" onChange={handleSearchChange} value={searchTerm}/>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
                <TableHead className="w-[60px] sm:w-[80px]">Image</TableHead><TableHead>Product Name</TableHead>
                <TableHead className="hidden md:table-cell">SKU</TableHead><TableHead className="hidden lg:table-cell">Unit</TableHead>
                <TableHead className="text-right">Current Stock</TableHead><TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filteredStockItems.map((item) => (
                <TableRow key={item.id}>
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
                  <TableCell className="hidden lg:table-cell">{item.unitOfMeasure || 'N/A'}</TableCell>
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
                    <Button variant="outline" size="sm" onClick={() => openUpdateStockDialog(item)}>
                        <Edit className="mr-2 h-3 w-3" />Update Stock
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           {filteredStockItems.length === 0 && !isLoading && (<div className="text-center py-8 text-muted-foreground">No products found matching your search or in the database.</div>)}
        </CardContent>
      </Card>
    </>
  );
}

