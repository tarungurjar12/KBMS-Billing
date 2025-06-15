
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Package, PlusCircle, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import Image from "next/image";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';

/**
 * @fileOverview Page for Admin to manage the Product Database in Firestore.
 * Allows Admin to perform full CRUD operations on products.
 */

export interface Product {
  id: string; // Firestore document ID
  name: string;
  sku: string;
  price: string; // Display string, e.g., "₹2,080.00"
  numericPrice: number; // For calculations and form input
  stock: number;
  category: string;
  unitOfMeasure: string;
  imageUrl: string;
  dataAiHint: string;
  createdAt?: Timestamp;
  // Future: description, supplierId, purchasePrice, lowStockThreshold, hsnCode, taxRate
}

// Predefined lists for form dropdowns - can be expanded or fetched from Firestore in future
const PRODUCT_CATEGORIES = ["Widgets", "Gizmos", "Doodads", "Thingamajigs", "Electronics", "Stationery", "Software", "Apparel", "Home Goods", "Building Materials", "Pipes & Fittings", "Cement", "Bricks", "Steel Bars", "Hardware", "Tools", "Paint", "Other"];
const UNITS_OF_MEASURE = ["pcs", "kg", "meter", "sq ft", "liter", "box", "bag", "set", "dozen", "ton", "bundle", "unit", "pair", "roll"];

// Zod schema for product form validation
const productSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  sku: z.string().min(3, { message: "SKU must be at least 3 characters." }),
  category: z.string().min(1, { message: "Please select a category." }),
  unitOfMeasure: z.string().min(1, { message: "Please select a unit of measure."}),
  numericPrice: z.preprocess(
    (val) => parseFloat(String(val).replace(/[^0-9.]+/g, "")),
    z.number({invalid_type_error: "Price must be a number."}).positive({ message: "Price must be a positive number." })
  ),
  stock: z.preprocess(
    (val) => parseInt(String(val).replace(/[^0-9]+/g, ""), 10),
    z.number({invalid_type_error: "Stock must be a whole number."}).int().min(0, { message: "Stock cannot be negative." })
  ),
  dataAiHint: z.string().min(2, {message: "Image hint must be at least 2 characters."}).max(20, {message: "Hint too long."}),
});

type ProductFormValues = z.infer<typeof productSchema>;

/**
 * Formats a number as an Indian Rupee string.
 * @param {number} num - The number to format.
 * @returns {string} A string representing the currency.
 */
const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * ProductsPage component.
 * Provides UI and logic for Admin to manage product data in Firestore.
 * @returns {JSX.Element} The rendered products page.
 */
export default function ProductsPage() {
  const [productList, setProductList] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const { toast } = useToast();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", sku: "", category: "", unitOfMeasure: "pcs", numericPrice: 0, stock: 0, dataAiHint: "" },
  });

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
             numericPrice: data.numericPrice || 0,
             price: formatCurrency(data.numericPrice || 0),
             stock: data.stock || 0,
             category: data.category || "Other",
             unitOfMeasure: data.unitOfMeasure || "pcs",
             imageUrl: data.imageUrl || `https://placehold.co/40x40.png?text=${data.name.substring(0,2)}`,
             dataAiHint: data.dataAiHint || "product item",
             createdAt: data.createdAt,
         } as Product;
      });
      setProductList(fetchedProducts);
    } catch (error) {
      console.error("Error fetching products: ", error);
      toast({ title: "Error", description: "Could not load products from database.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (editingProduct && isFormDialogOpen) {
      form.reset({
        name: editingProduct.name,
        sku: editingProduct.sku,
        category: editingProduct.category,
        unitOfMeasure: editingProduct.unitOfMeasure,
        numericPrice: editingProduct.numericPrice,
        stock: editingProduct.stock,
        dataAiHint: editingProduct.dataAiHint,
      });
    } else {
      form.reset({ name: "", sku: "", category: "", unitOfMeasure: "pcs", numericPrice: 0, stock: 0, dataAiHint: "" });
    }
  }, [editingProduct, isFormDialogOpen, form]);

  const handleFormSubmit = async (values: ProductFormValues) => {
    try {
      const productData = { 
         ...values, 
         imageUrl: `https://placehold.co/100x100.png?text=${values.name.substring(0,2)}`, // Generate placeholder based on name
         createdAt: serverTimestamp() 
      };
      // Note: 'price' (formatted string) is not stored, only 'numericPrice'. It's formatted on retrieval.

      if (editingProduct) {
        const productRef = doc(db, "products", editingProduct.id);
        await updateDoc(productRef, productData);
        toast({ title: "Product Updated", description: `${values.name} updated in Firestore.` });
      } else {
        await addDoc(collection(db, "products"), productData);
        toast({ title: "Product Added", description: `${values.name} added to Firestore.` });
      }
      fetchProducts(); // Refresh list
      setIsFormDialogOpen(false);
      setEditingProduct(null);
    } catch (error) {
      console.error("Error saving product: ", error);
      toast({ title: "Error", description: "Failed to save product to database.", variant: "destructive" });
    }
  };
  
  const openAddDialog = () => {
    setEditingProduct(null);
    // form.reset(); // Reset in useEffect will handle this
    setIsFormDialogOpen(true);
  };
  
  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setIsFormDialogOpen(true);
  };

  const openDeleteDialog = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteDoc(doc(db, "products", productToDelete.id));
      toast({ title: "Product Deleted", description: `${productToDelete.name} deleted from Firestore.`, variant: "default" });
      fetchProducts(); // Refresh
      setProductToDelete(null);
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      console.error("Error deleting product: ", error);
      toast({ title: "Error", description: "Failed to delete product from database.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <PageHeader title="Product Database" description="Loading product data from database..." icon={Package} />;
  }

  return (
    <>
      <PageHeader
        title="Product Database"
        description="Manage product information, pricing, and inventory. (Admin Only)"
        icon={Package}
        actions={<Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Add New Product</Button>}
      />

      <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { if(!isOpen) { setIsFormDialogOpen(false); setEditingProduct(null); form.reset(); } else { setIsFormDialogOpen(isOpen); }}}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? `Update details for "${editingProduct.name}".` : "Fill in details to add a new product."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Product Name</FormLabel><FormControl><Input placeholder="e.g., Super Widget X" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="sku" render={({ field }) => (<FormItem><FormLabel>SKU</FormLabel><FormControl><Input placeholder="e.g., SWX-001" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""} defaultValue={field.value || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                      <SelectContent>{PRODUCT_CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>)}
                />
                <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (
                  <FormItem><FormLabel>Unit of Measure</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""} defaultValue={field.value || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger></FormControl>
                      <SelectContent>{UNITS_OF_MEASURE.map((unit) => (<SelectItem key={unit} value={unit}>{unit}</SelectItem>))}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="numericPrice" render={({ field }) => (<FormItem><FormLabel>Price (₹)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 1999.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="stock" render={({ field }) => (<FormItem><FormLabel>Stock Quantity</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="dataAiHint" render={({ field }) => (<FormItem><FormLabel>Image Hint</FormLabel><FormControl><Input placeholder="e.g., blue gadget or shiny pipe" {...field} /></FormControl><FormDescription>Keywords for placeholder image.</FormDescription><FormMessage /></FormItem>)} />
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2">
                <DialogClose asChild><Button type="button" variant="outline" onClick={() => { setIsFormDialogOpen(false); setEditingProduct(null);}}>Cancel</Button></DialogClose>
                <Button type="submit">{editingProduct ? "Save Changes" : "Add Product"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setProductToDelete(null); setIsDeleteConfirmOpen(isOpen);}}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{productToDelete?.name}". This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => {setIsDeleteConfirmOpen(false); setProductToDelete(null);}}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="shadow-lg rounded-xl">
        <CardHeader><CardTitle className="font-headline text-foreground">Product List</CardTitle><CardDescription>A list of all available products from Firestore.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
                <TableHead className="w-[80px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {productList.map((product) => (
                <TableRow key={product.id}>
                  <TableCell><Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md object-cover" data-ai-hint={product.dataAiHint} /></TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>{product.unitOfMeasure}</TableCell>
                  <TableCell className="text-right">{product.price}</TableCell>
                  <TableCell className="text-right">{product.stock}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Actions</span></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(product)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDeleteDialog(product)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           {productList.length === 0 && !isLoading && (<div className="text-center py-8 text-muted-foreground">No products found.</div>)}
        </CardContent>
      </Card>
    </>
  );
}
