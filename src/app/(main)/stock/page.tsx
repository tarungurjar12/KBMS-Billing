
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Boxes, PackageSearch, Edit, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

interface StockItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  imageUrl: string;
  dataAiHint: string;
  unitOfMeasure?: string; // Added from product
}

const initialStockItems: StockItem[] = [
  { id: "PROD001", name: "Premium Widget", sku: "PW-001", stock: 150, status: "In Stock", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "gadget tool", unitOfMeasure: "pcs" },
  { id: "PROD002", name: "Standard Gizmo", sku: "SG-002", stock: 25, status: "Low Stock", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "device item", unitOfMeasure: "pcs" },
  { id: "PROD003", name: "Luxury Doodad", sku: "LD-003", stock: 0, status: "Out of Stock", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "object thing", unitOfMeasure: "box" },
  { id: "PROD004", name: "Basic Thingamajig", sku: "BT-004", stock: 500, status: "In Stock", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "item gadget", unitOfMeasure: "pcs" },
];

const stockUpdateSchema = z.object({
  newStock: z.preprocess(
    (val) => parseInt(String(val), 10),
    z.number({invalid_type_error: "Stock must be a whole number."}).int().min(0, { message: "Stock cannot be negative." })
  ),
  adjustmentType: z.enum(["set", "add", "subtract"]).default("set"),
  adjustmentValue: z.preprocess(
    (val) => parseInt(String(val), 10),
    z.number({invalid_type_error: "Adjustment must be a whole number."}).int().optional()
  ),
}).refine(data => data.adjustmentType === 'set' || data.adjustmentValue !== undefined, {
    message: "Adjustment value is required for 'add' or 'subtract'",
    path: ["adjustmentValue"],
});


type StockUpdateFormValues = z.infer<typeof stockUpdateSchema>;

export default function StockPage() {
  const [stockList, setStockList] = useState<StockItem[]>(initialStockItems);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdateStockDialogOpen, setIsUpdateStockDialogOpen] = useState(false);
  const [productToUpdateStock, setProductToUpdateStock] = useState<StockItem | null>(null);
  const { toast } = useToast();

  const form = useForm<StockUpdateFormValues>({
    resolver: zodResolver(stockUpdateSchema),
    defaultValues: {
      newStock: 0,
      adjustmentType: "set",
      adjustmentValue: undefined,
    },
  });

  useEffect(() => {
    // Placeholder for fetching stock items from a data source
    // async function fetchStock() {
    //   // const fetchedStock = await db.getStockItems(); // Future cloud integration
    //   // setStockList(fetchedStock.map(item => ({...item, status: getStatus(item.stock) })));
    // }
    // fetchStock();
    // For now, using initialStockItems
    setStockList(initialStockItems.map(item => ({...item, status: getStatus(item.stock) })));
  }, []);

  const getStatus = (stock: number): "In Stock" | "Low Stock" | "Out of Stock" => {
    if (stock <= 0) return "Out of Stock";
    if (stock < 50) return "Low Stock"; // Assuming low stock threshold is 50
    return "In Stock";
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value.toLowerCase());
  };

  const filteredStockItems = stockList.filter(item =>
    item.name.toLowerCase().includes(searchTerm) ||
    item.sku.toLowerCase().includes(searchTerm)
  );
  
  const openUpdateStockDialog = (item: StockItem) => {
    setProductToUpdateStock(item);
    form.reset({ newStock: item.stock, adjustmentType: "set", adjustmentValue: undefined });
    setIsUpdateStockDialogOpen(true);
  };

  const handleUpdateStockSubmit = (values: StockUpdateFormValues) => {
    if (!productToUpdateStock) return;

    let finalStock = productToUpdateStock.stock;
    if (values.adjustmentType === "set") {
        finalStock = values.newStock;
    } else if (values.adjustmentType === "add" && values.adjustmentValue !== undefined) {
        finalStock += values.adjustmentValue;
    } else if (values.adjustmentType === "subtract" && values.adjustmentValue !== undefined) {
        finalStock -= values.adjustmentValue;
        if (finalStock < 0) finalStock = 0; // Prevent negative stock
    }


    // For future cloud integration:
    // try {
    //   await api.updateProductStock(productToUpdateStock.id, finalStock); // Example API call
    //   setStockList((prev) =>
    //     prev.map((p) =>
    //       p.id === productToUpdateStock.id ? { ...p, stock: finalStock, status: getStatus(finalStock) } : p
    //     )
    //   );
    // } catch (error) {
    //   toast({ title: "Error", description: "Failed to update stock.", variant: "destructive" });
    //   return;
    // }

    setStockList((prev) =>
      prev.map((p) =>
        p.id === productToUpdateStock.id ? { ...p, stock: finalStock, status: getStatus(finalStock) } : p
      )
    );

    toast({
      title: "Stock Updated",
      description: `Stock for ${productToUpdateStock.name} updated to ${finalStock}.`,
    });
    setProductToUpdateStock(null);
    setIsUpdateStockDialogOpen(false);
    form.reset();
  };


  return (
    <>
      <PageHeader
        title="Inventory Levels" // Changed from "Stock Availability" to match Admin flow
        description="View and update current inventory status for all products." // Updated description
        icon={Boxes}
      />

      {/* Update Stock Dialog */}
      <Dialog open={isUpdateStockDialogOpen} onOpenChange={(isOpen) => {
          setIsUpdateStockDialogOpen(isOpen);
          if (!isOpen) setProductToUpdateStock(null);
        }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Update Stock for &quot;{productToUpdateStock?.name}&quot;</DialogTitle>
            <DialogDescription>
              Current Stock: {productToUpdateStock?.stock} {productToUpdateStock?.unitOfMeasure || 'units'}. 
              Enter the new total quantity or adjust the current stock.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdateStockSubmit)} className="space-y-4 py-2">
              <FormField
                control={form.control}
                name="adjustmentType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Adjustment Type</FormLabel>
                    <FormControl>
                        <div className="flex gap-4">
                           <Button type="button" variant={field.value === 'set' ? 'default' : 'outline'} onClick={() => field.onChange('set')}>Set New Total</Button>
                           <Button type="button" variant={field.value === 'add' ? 'default' : 'outline'} onClick={() => field.onChange('add')}>Add to Stock</Button>
                           <Button type="button" variant={field.value === 'subtract' ? 'default' : 'outline'} onClick={() => field.onChange('subtract')}>Subtract from Stock</Button>
                        </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch("adjustmentType") === 'set' && (
                <FormField
                  control={form.control}
                  name="newStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Total Stock Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {(form.watch("adjustmentType") === 'add' || form.watch("adjustmentType") === 'subtract') && (
                 <FormField
                  control={form.control}
                  name="adjustmentValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity to {form.watch("adjustmentType")}</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 10" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
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
              <Input type="search" placeholder="Search products..." className="pl-8" onChange={handleSearchChange} />
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
                    <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="rounded-md" data-ai-hint={item.dataAiHint} />
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
                        "" /* destructive variant handles out of stock */
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
           {filteredStockItems.length === 0 && (
             <div className="text-center py-8 text-muted-foreground">
                No products found matching your search.
             </div>
           )}
        </CardContent>
      </Card>
      {/* Comment for future data persistence:
          The 'stockList' state is currently managed locally.
          In a production environment with cloud integration (e.g., Firebase Firestore):
          - Stock levels would be part of the product data or a separate inventory collection.
          - Fetching would get real-time stock.
          - Updating stock would call an API endpoint to update the database, possibly using transactions
            if linked with sales.
          - Example: `await firestore.collection('products').doc(productId).update({ stock: newStockLevel });`
          - The `getStatus` logic might also consider reorder points fetched from the database.
      */}
    </>
  );
}

    