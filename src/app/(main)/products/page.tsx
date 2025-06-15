
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Package, PlusCircle, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import Image from "next/image"; // Next.js Image component for optimized images
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea"; // Added for product description
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';

/**
 * @fileOverview Page for Admin to manage the Product Database in Firestore.
 * Allows Admin to perform full CRUD operations on products, including details like name, SKU,
 * price, stock, category, unit of measure, description, and image hints for placeholders.
 * Data is fetched from and saved to Firebase Firestore.
 */

/**
 * Interface representing a Product document in Firestore.
 */
export interface Product {
  id: string; // Firestore document ID
  name: string;
  sku: string; // Stock Keeping Unit
  description?: string; // Optional product description
  price: string; // Formatted display string for price, e.g., "₹2,080.00"
  numericPrice: number; // Numeric price for calculations and form input
  stock: number; // Current stock quantity
  category: string; // Product category
  unitOfMeasure: string; // Unit of measure (e.g., pcs, kg, meter)
  imageUrl: string; // URL for product image (placeholder or actual)
  dataAiHint: string; // Keywords for AI-assisted image searching or placeholder generation
  createdAt?: Timestamp; // Firestore Timestamp of creation
  updatedAt?: Timestamp; // Firestore Timestamp of last update
  // Future fields: supplierId, purchasePrice, lowStockThreshold, hsnCode, taxRate
}

// Predefined lists for form dropdowns - can be expanded or fetched from Firestore in future
const PRODUCT_CATEGORIES = ["Widgets", "Gizmos", "Doodads", "Thingamajigs", "Electronics", "Stationery", "Software", "Apparel", "Home Goods", "Building Materials", "Pipes & Fittings", "Cement", "Bricks", "Steel Bars", "Hardware", "Tools", "Paint", "Other"];
const UNITS_OF_MEASURE = ["pcs", "kg", "meter", "sq ft", "liter", "box", "bag", "set", "dozen", "ton", "bundle", "unit", "pair", "roll", "nos"];

// Zod schema for product form validation
const productSchema = z.object({
  name: z.string().min(3, { message: "Product name must be at least 3 characters." }),
  sku: z.string().min(3, { message: "SKU must be at least 3 characters." }).regex(/^[a-zA-Z0-9-]+$/, { message: "SKU can only contain letters, numbers, and hyphens."}),
  description: z.string().optional(),
  category: z.string().min(1, { message: "Please select a product category." }),
  unitOfMeasure: z.string().min(1, { message: "Please select a unit of measure."}),
  numericPrice: z.preprocess(
    (val) => parseFloat(String(val).replace(/[^0-9.]+/g, "")), // Clean and parse price
    z.number({invalid_type_error: "Price must be a valid number."}).positive({ message: "Price must be a positive value." })
  ),
  stock: z.preprocess(
    (val) => parseInt(String(val).replace(/[^0-9]+/g, ""), 10), // Clean and parse stock
    z.number({invalid_type_error: "Stock quantity must be a whole number."}).int().min(0, { message: "Stock quantity cannot be negative." })
  ),
  dataAiHint: z.string().min(2, {message: "Image hint must be at least 2 characters."}).max(30, {message: "Image hint too long (max 30 characters)."}),
});

type ProductFormValues = z.infer<typeof productSchema>;

/**
 * Formats a number as an Indian Rupee string.
 * @param {number} num - The number to format.
 * @returns {string} A string representing the currency, e.g., "₹1,234.56".
 */
const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * ProductsPage component.
 * Provides UI and logic for Admin to manage product data in Firestore.
 * Handles CRUD operations, dialogs for add/edit, and form validation.
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

  // React Hook Form setup
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", sku: "", category: "", unitOfMeasure: "pcs", numericPrice: 0, stock: 0, dataAiHint: "", description: "" },
  });

  /**
   * Fetches product list from Firestore, ordered by name.
   * Transforms Firestore data into the Product interface for UI display.
   */
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
             description: data.description || "",
             numericPrice: data.numericPrice || 0,
             price: formatCurrency(data.numericPrice || 0), // Format price for display
             stock: data.stock || 0,
             category: data.category || "Other",
             unitOfMeasure: data.unitOfMeasure || "pcs",
             // Generate a placeholder image URL using product name initials if no imageUrl is present
             imageUrl: data.imageUrl || `https://placehold.co/40x40.png?text=${encodeURIComponent(data.name.substring(0,2).toUpperCase())}`,
             dataAiHint: data.dataAiHint || "product item", // Default AI hint
             createdAt: data.createdAt,
             updatedAt: data.updatedAt,
         } as Product;
      });
      setProductList(fetchedProducts);
    } catch (error) {
      console.error("Error fetching products: ", error);
      toast({ title: "Database Error", description: "Could not load products. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Fetch products when the component mounts
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Effect to reset form when editingProduct or dialog state changes
  useEffect(() => {
    if (editingProduct && isFormDialogOpen) {
      form.reset({
        name: editingProduct.name,
        sku: editingProduct.sku,
        description: editingProduct.description || "",
        category: editingProduct.category,
        unitOfMeasure: editingProduct.unitOfMeasure,
        numericPrice: editingProduct.numericPrice,
        stock: editingProduct.stock,
        dataAiHint: editingProduct.dataAiHint,
      });
    } else if (isFormDialogOpen && !editingProduct) { // For "Add New"
      form.reset({ name: "", sku: "", description: "", category: PRODUCT_CATEGORIES[0] || "", unitOfMeasure: UNITS_OF_MEASURE[0] || "pcs", numericPrice: 0, stock: 0, dataAiHint: "" });
    }
  }, [editingProduct, isFormDialogOpen, form]);

  /**
   * Handles submission of the product form (for both add and edit).
   * Saves or updates the product data in Firestore.
   * @param {ProductFormValues} values - The validated form values.
   */
  const handleFormSubmit = async (values: ProductFormValues) => {
    try {
      const productData = { 
         ...values, 
         // Generate placeholder image URL based on name initials and dataAiHint for better placeholder
         imageUrl: `https://placehold.co/100x100.png?text=${encodeURIComponent(values.name.substring(0,2).toUpperCase())}`,
         // `price` (formatted string) is not stored, only `numericPrice`. It's formatted on retrieval.
      };

      if (editingProduct) { // Update existing product
        const productRef = doc(db, "products", editingProduct.id);
        await updateDoc(productRef, {...productData, updatedAt: serverTimestamp()});
        toast({ title: "Product Updated", description: `Product "${values.name}" has been updated successfully.` });
      } else { // Add new product
        await addDoc(collection(db, "products"), {...productData, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
        toast({ title: "Product Added", description: `New product "${values.name}" has been added successfully.` });
      }
      fetchProducts(); // Refresh the product list
      setIsFormDialogOpen(false); // Close the dialog
      setEditingProduct(null); // Clear editing state
    } catch (error) {
      console.error("Error saving product: ", error);
      toast({ title: "Save Error", description: "Failed to save product to the database. Please try again.", variant: "destructive" });
    }
  };
  
  /**
   * Opens the dialog for adding a new product.
   */
  const openAddDialog = () => {
    setEditingProduct(null);
    // Form reset is handled by useEffect
    setIsFormDialogOpen(true);
  };
  
  /**
   * Opens the dialog for editing an existing product and pre-fills the form.
   * @param {Product} product - The product to edit.
   */
  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    // Form reset with product data is handled by useEffect
    setIsFormDialogOpen(true);
  };

  /**
   * Opens the delete confirmation dialog for a product.
   * @param {Product} product - The product to delete.
   */
  const openDeleteDialog = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteConfirmOpen(true);
  };

  /**
   * Confirms and executes deletion of a product from Firestore.
   */
  const confirmDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteDoc(doc(db, "products", productToDelete.id));
      toast({ title: "Product Deleted", description: `Product "${productToDelete.name}" has been deleted successfully.`, variant: "default" });
      fetchProducts(); // Refresh the list
    } catch (error) {
      console.error("Error deleting product: ", error);
      toast({ title: "Deletion Error", description: "Failed to delete product from the database. Please try again.", variant: "destructive" });
    } finally {
      setProductToDelete(null);
      setIsDeleteConfirmOpen(false); // Close confirmation dialog
    }
  };

  // Display loading state
  if (isLoading) {
    return <PageHeader title="Product Database" description="Loading product data from database..." icon={Package} />;
  }

  return (
    <>
      <PageHeader
        title="Product Database"
        description="Manage product information, pricing, and inventory levels. (Admin Only)"
        icon={Package}
        actions={<Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Add New Product</Button>}
      />

      {/* Dialog for Adding or Editing Products */}
      <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { 
          if(!isOpen) { 
            setIsFormDialogOpen(false); 
            setEditingProduct(null); 
            form.reset(); // Ensure form is reset when dialog closes
          } else { 
            setIsFormDialogOpen(isOpen); 
          }
      }}>
        <DialogContent className="sm:max-w-lg"> {/* Increased max-width for more space */}
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product Details" : "Add New Product"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? `Update details for "${editingProduct.name}".` : "Fill in all required product details."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-3"> {/* Added padding-right for scrollbar */}
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Product Name</FormLabel><FormControl><Input placeholder="e.g., Premium Widget Model X" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="sku" render={({ field }) => (<FormItem><FormLabel>SKU (Stock Keeping Unit)</FormLabel><FormControl><Input placeholder="e.g., WIDGET-X-PREM001" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="Detailed description of the product, features, specifications..." {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select product category" /></SelectTrigger></FormControl>
                      <SelectContent>{PRODUCT_CATEGORIES.map((cat) => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>)}
                />
                <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (
                  <FormItem><FormLabel>Unit of Measure</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger></FormControl>
                      <SelectContent>{UNITS_OF_MEASURE.map((unit) => (<SelectItem key={unit} value={unit}>{unit}</SelectItem>))}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="numericPrice" render={({ field }) => (<FormItem><FormLabel>Price (₹)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 1999.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="stock" render={({ field }) => (<FormItem><FormLabel>Stock Quantity</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="dataAiHint" render={({ field }) => (<FormItem><FormLabel>Image Hint</FormLabel><FormControl><Input placeholder="e.g., blue gadget or shiny pipe" {...field} /></FormControl><FormDescription>Keywords for placeholder image (e.g., &quot;steel pipe&quot;, &quot;red brick&quot;). Max 2-3 words.</FormDescription><FormMessage /></FormItem>)} />
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 border-t"> {/* Added border-t */}
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? (editingProduct ? "Saving..." : "Adding...") : (editingProduct ? "Save Changes" : "Add Product")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setProductToDelete(null); setIsDeleteConfirmOpen(isOpen);}}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the product &quot;{productToDelete?.name}&quot; from the database.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => {setIsDeleteConfirmOpen(false); setProductToDelete(null);}}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete Product</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Product List Table */}
      <Card className="shadow-lg rounded-xl">
        <CardHeader><CardTitle className="font-headline text-foreground">Product List</CardTitle><CardDescription>A comprehensive list of all available products from Firestore, ordered by name.</CardDescription></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
                <TableHead className="w-[60px] sm:w-[80px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">SKU</TableHead>
                <TableHead className="hidden lg:table-cell">Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Price (₹)</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {productList.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Image 
                        src={product.imageUrl} 
                        alt={product.name} 
                        width={40} 
                        height={40} 
                        className="rounded-md object-cover border" 
                        data-ai-hint={product.dataAiHint}
                        onError={(e) => { e.currentTarget.src = `https://placehold.co/40x40.png?text=${encodeURIComponent(product.name.substring(0,2).toUpperCase())}`; }} // Fallback for broken images
                    />
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{product.sku}</TableCell>
                  <TableCell className="hidden lg:table-cell">{product.category}</TableCell>
                  <TableCell>{product.unitOfMeasure}</TableCell>
                  <TableCell className="text-right font-semibold">{product.price}</TableCell>
                  <TableCell className="text-right">{product.stock}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Actions for {product.name}</span></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(product)}><Edit className="mr-2 h-4 w-4" />Edit Product</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDeleteDialog(product)} className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground">
                            <Trash2 className="mr-2 h-4 w-4" />Delete Product
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           {productList.length === 0 && !isLoading && (<div className="text-center py-8 text-muted-foreground">No products found in the database. Click "Add New Product" to get started.</div>)}
        </CardContent>
      </Card>
    </>
  );
}

