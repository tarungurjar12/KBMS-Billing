
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Package, PlusCircle, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import Image from "next/image";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
// Future: Import Firebase functions for Firestore operations
// import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
// import { db } from '@/lib/firebase/firebaseConfig';

/**
 * @fileOverview Page for Admin to manage the Product Database.
 * Allows Admin to perform full CRUD operations on products, including details like
 * name, SKU, category, unit of measure, price, and initial stock.
 * Store Managers can view product and price information (read-only) on a separate page
 * and report issues, but cannot edit products here.
 */

interface Product {
  id: string; // Firestore document ID or unique local ID
  name: string;
  sku: string;
  price: string; // Display string, e.g., "₹2,080.00"
  numericPrice: number; // For calculations and form input
  stock: number;
  category: string;
  unitOfMeasure: string;
  imageUrl: string;
  dataAiHint: string; // For placeholder image generation hints
  // Future: Add description, supplierId (for default supplier), purchasePrice (from default supplier), lowStockThreshold
}

// Initial dummy data for products. This will be replaced by Firestore data in Phase 2.
const initialProducts: Product[] = [
  { id: "PROD-LOCAL-001", name: "Premium Widget", sku: "PW-001", price: "₹2,080.00", numericPrice: 2080, stock: 150, category: "Widgets", unitOfMeasure: "pcs", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "gadget tool" },
  { id: "PROD-LOCAL-002", name: "Standard Gizmo", sku: "SG-002", price: "₹1,240.00", numericPrice: 1240, stock: 250, category: "Gizmos", unitOfMeasure: "pcs", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "device item" },
  { id: "PROD-LOCAL-003", name: "Luxury Doodad", sku: "LD-003", price: "₹3,995.00", numericPrice: 3995, stock: 75, category: "Doodads", unitOfMeasure: "box", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "object thing" },
  { id: "PROD-LOCAL-004", name: "Basic Thingamajig", sku: "BT-004", price: "₹800.00", numericPrice: 800, stock: 500, category: "Thingamajigs", unitOfMeasure: "pcs", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "item gadget" },
];

// Predefined lists for form dropdowns
const PRODUCT_CATEGORIES = ["Widgets", "Gizmos", "Doodads", "Thingamajigs", "Electronics", "Stationery", "Software", "Apparel", "Home Goods", "Building Materials", "Pipes & Fittings", "Cement", "Bricks", "Steel Bars"];
const UNITS_OF_MEASURE = ["pcs", "kg", "meter", "sq ft", "liter", "box", "bag", "set", "dozen", "ton", "bundle"];

// Zod schema for product form validation
const productSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  sku: z.string().min(3, { message: "SKU must be at least 3 characters." }),
  category: z.string().min(1, { message: "Please select a category." }),
  unitOfMeasure: z.string().min(1, { message: "Please select a unit of measure."}),
  price: z.preprocess( // Converts input string to number
    (val) => parseFloat(String(val).replace(/[^0-9.]+/g, "")), // Allow only numbers and a decimal point
    z.number({invalid_type_error: "Price must be a number."}).positive({ message: "Price must be a positive number." })
  ),
  stock: z.preprocess( // Converts input string to integer
    (val) => parseInt(String(val).replace(/[^0-9]+/g, ""), 10), // Allow only numbers
    z.number({invalid_type_error: "Stock must be a whole number."}).int().min(0, { message: "Stock cannot be negative." })
  ),
  // Future: Add validation for description, supplierId, purchasePrice etc.
});

type ProductFormValues = z.infer<typeof productSchema>;

/**
 * ProductsPage component.
 * Provides UI and logic for Admin to manage product data.
 */
export default function ProductsPage() {
  const [productList, setProductList] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
  const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const { toast } = useToast();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      category: "",
      unitOfMeasure: "pcs", // Default unit
      price: 0,
      stock: 0,
    },
  });

  // Effect to load products (currently from initial data, future from Firestore)
  useEffect(() => {
    // Future: Fetch products from Firestore
    // const fetchProducts = async () => {
    //   setIsLoading(true);
    //   try {
    //     const querySnapshot = await getDocs(collection(db, "products"));
    //     const fetchedProducts = querySnapshot.docs.map(doc => {
    //        const data = doc.data();
    //        return { 
    //            id: doc.id, 
    //            ...data,
    //            price: `₹${Number(data.numericPrice || 0).toFixed(2)}`, // Ensure price is formatted
    //        } as Product;
    //     });
    //     setProductList(fetchedProducts);
    //   } catch (error) {
    //     console.error("Error fetching products: ", error);
    //     toast({ title: "Error", description: "Could not load products.", variant: "destructive" });
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    // fetchProducts();

    // Phase 1: Use local data
    setProductList(initialProducts);
    setIsLoading(false);
  }, [toast]);


  // Effect to reset form when edit dialog opens/closes or editingProduct changes
  useEffect(() => {
    if (editingProduct && isEditProductDialogOpen) {
      form.reset({
        name: editingProduct.name,
        sku: editingProduct.sku,
        category: editingProduct.category,
        unitOfMeasure: editingProduct.unitOfMeasure,
        price: editingProduct.numericPrice, // Use numericPrice for form input
        stock: editingProduct.stock,
      });
    } else {
      // Reset for add dialog or on close
      form.reset({ name: "", sku: "", category: "", unitOfMeasure: "pcs", price: 0, stock: 0 });
    }
  }, [editingProduct, isEditProductDialogOpen, form]);

  /**
   * Formats a number as an Indian Rupee string.
   * @param num - The number to format.
   * @returns A string representing the currency, e.g., "₹1,234.50".
   */
  const formatCurrency = (num: number) => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /**
   * Handles submission of the "Add New Product" form.
   * Phase 1: Adds to local state.
   * Future: Adds product to Firestore.
   */
  const handleAddSubmit = (values: ProductFormValues) => {
    // Future: Firebase integration
    // try {
    //   const newProductData = { 
    //      ...values, 
    //      numericPrice: values.price, // Store numeric price for sorting/filtering
    //      imageUrl: "https://placehold.co/40x40.png", // Default placeholder
    //      dataAiHint: values.category.toLowerCase().split(" ")[0] || "product",
    //      createdAt: serverTimestamp() 
    //   };
    //   // Do not store the formatted 'price' string in Firestore, only numericPrice. Format on retrieval.
    //   const docRef = await addDoc(collection(db, "products"), newProductData);
    //   setProductList((prev) => [{ ...newProductData, id: docRef.id, price: formatCurrency(values.price) }, ...prev]);
    // } catch (error) {
    //   console.error("Error adding product: ", error);
    //   toast({ title: "Error", description: "Failed to add product.", variant: "destructive" });
    //   return;
    // }

    // Phase 1: Local state update
    const newId = `PROD-LOCAL-${Date.now()}`;
    const newProduct: Product = {
      id: newId,
      name: values.name,
      sku: values.sku,
      price: formatCurrency(values.price),
      numericPrice: values.price,
      stock: values.stock,
      category: values.category,
      unitOfMeasure: values.unitOfMeasure,
      imageUrl: "https://placehold.co/40x40.png", 
      dataAiHint: values.category.toLowerCase().split(" ")[0] || values.name.toLowerCase().split(" ")[0] || "product",
    };
    setProductList((prevProducts) => [newProduct, ...prevProducts]);
    toast({
      title: "Product Added (Locally)",
      description: `${values.name} has been successfully added.`,
    });
    form.reset();
    setIsAddProductDialogOpen(false);
  };

  /**
   * Handles submission of the "Edit Product" form.
   * Phase 1: Updates local state.
   * Future: Updates product in Firestore.
   */
  const handleEditSubmit = (values: ProductFormValues) => {
    if (!editingProduct) return;

    // Future: Firebase integration
    // try {
    //   const productRef = doc(db, "products", editingProduct.id);
    //   const updatedData = { 
    //       ...values, 
    //       numericPrice: values.price,
    //       dataAiHint: values.category.toLowerCase().split(" ")[0] || values.name.toLowerCase().split(" ")[0] || "product",
    //       // Do not store formatted 'price' in Firestore
    //   };
    //   await updateDoc(productRef, updatedData);
    //   setProductList((prev) =>
    //     prev.map((p) => (p.id === editingProduct.id ? { ...p, ...updatedData, price: formatCurrency(values.price) } : p))
    //   );
    // } catch (error) {
    //   console.error("Error updating product: ", error);
    //   toast({ title: "Error", description: "Failed to update product.", variant: "destructive" });
    //   return;
    // }

    // Phase 1: Local state update
    const updatedProduct: Product = {
      ...editingProduct,
      name: values.name,
      sku: values.sku,
      price: formatCurrency(values.price),
      numericPrice: values.price,
      stock: values.stock,
      category: values.category,
      unitOfMeasure: values.unitOfMeasure,
      dataAiHint: values.category.toLowerCase().split(" ")[0] || values.name.toLowerCase().split(" ")[0] || "product",
    };

    setProductList((prevProducts) =>
      prevProducts.map((p) => (p.id === editingProduct.id ? updatedProduct : p))
    );
    toast({
      title: "Product Updated (Locally)",
      description: `${values.name} has been successfully updated.`,
    });
    setEditingProduct(null);
    setIsEditProductDialogOpen(false);
    form.reset();
  };
  
  /**
   * Opens the edit dialog and populates form with product data.
   */
  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setIsEditProductDialogOpen(true);
  };

  /**
   * Opens the delete confirmation dialog.
   */
  const openDeleteDialog = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteConfirmOpen(true);
  };

  /**
   * Confirms and performs product deletion.
   * Phase 1: Removes from local state.
   * Future: Deletes product from Firestore.
   */
  const confirmDelete = () => {
    if (!productToDelete) return;

    // Future: Firebase integration
    // try {
    //   await deleteDoc(doc(db, "products", productToDelete.id));
    //   setProductList((prev) => prev.filter((p) => p.id !== productToDelete.id));
    // } catch (error) {
    //   console.error("Error deleting product: ", error);
    //   toast({ title: "Error", description: "Failed to delete product.", variant: "destructive" });
    //   return;
    // }

    // Phase 1: Local state update
    setProductList((prevProducts) => prevProducts.filter((p) => p.id !== productToDelete.id));
    toast({
      title: "Product Deleted (Locally)",
      description: `${productToDelete.name} has been successfully deleted.`,
      variant: "destructive"
    });
    setProductToDelete(null);
    setIsDeleteConfirmOpen(false);
  };

  if (isLoading) {
    return <PageHeader title="Product Database" description="Loading product data..." icon={Package} />;
  }

  return (
    <>
      <PageHeader
        title="Product Database"
        description="Manage product information, pricing, and initial inventory. (Admin Only)"
        icon={Package}
        actions={
          <Button onClick={() => { form.reset(); setIsAddProductDialogOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Product
          </Button>
        }
      />

      {/* Add Product Dialog */}
      <Dialog open={isAddProductDialogOpen} onOpenChange={(isOpen) => {
          setIsAddProductDialogOpen(isOpen);
          if (!isOpen) form.reset();
        }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Fill in the details below to add a new product to the database.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
              <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Super Widget X" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="sku" render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU (Stock Keeping Unit)</FormLabel>
                    <FormControl><Input placeholder="e.g., SWX-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                        <SelectContent>{PRODUCT_CATEGORIES.map((category) => (<SelectItem key={category} value={category}>{category}</SelectItem>))}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Unit of Measure</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a unit" /></SelectTrigger></FormControl>
                        <SelectContent>{UNITS_OF_MEASURE.map((unit) => (<SelectItem key={unit} value={unit}>{unit}</SelectItem>))}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (₹)</FormLabel>
                      <FormControl><Input type="number" step="0.01" placeholder="e.g., 1999.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="stock" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Stock Quantity</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {/* Future: Add fields for description, supplier, purchase price */}
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit">Add Product</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Product Dialog */}
       <Dialog open={isEditProductDialogOpen} onOpenChange={(isOpen) => {
          setIsEditProductDialogOpen(isOpen);
          if (!isOpen) setEditingProduct(null); 
        }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update the details for &quot;{editingProduct?.name}&quot;.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
            <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Super Widget X" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="sku" render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU (Stock Keeping Unit)</FormLabel>
                    <FormControl><Input placeholder="e.g., SWX-001" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                        <SelectContent>{PRODUCT_CATEGORIES.map((category) => (<SelectItem key={category} value={category}>{category}</SelectItem>))}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Unit of Measure</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a unit" /></SelectTrigger></FormControl>
                        <SelectContent>{UNITS_OF_MEASURE.map((unit) => (<SelectItem key={unit} value={unit}>{unit}</SelectItem>))}</SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (₹)</FormLabel>
                      <FormControl><Input type="number" step="0.01" placeholder="e.g., 1999.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="stock" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Quantity</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}/></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
               {/* Future: Add fields for description, supplier, purchase price */}
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2">
                 <DialogClose asChild><Button type="button" variant="outline" onClick={() => { setIsEditProductDialogOpen(false); setEditingProduct(null); }}>Cancel</Button></DialogClose>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setProductToDelete(null); setIsDeleteConfirmOpen(isOpen);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the product &quot;{productToDelete?.name}&quot; from the database.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {setIsDeleteConfirmOpen(false); setProductToDelete(null);}}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Product List</CardTitle>
          <CardDescription>A list of all available products.</CardDescription>
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
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productList.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md object-cover" data-ai-hint={product.dataAiHint} />
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.sku}</TableCell>
                  <TableCell>{product.category}</TableCell>
                  <TableCell>{product.unitOfMeasure}</TableCell>
                  <TableCell className="text-right">{product.price}</TableCell>
                  <TableCell className="text-right">{product.stock}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Actions for {product.name}</span></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(product)}><Edit className="mr-2 h-4 w-4" />Edit Product</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDeleteDialog(product)} className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground"><Trash2 className="mr-2 h-4 w-4" />Delete Product</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           {productList.length === 0 && !isLoading && (
             <div className="text-center py-8 text-muted-foreground">
                No products found. Click "Add New Product" to get started.
             </div>
           )}
        </CardContent>
      </Card>
      {/* 
        Phase 1 Data Storage: Product data is stored in local component state.
        Phase 2 (Future-Ready):
        - Product data will be stored in a 'products' collection in Firebase Firestore.
        - Fields would include: name, sku, numericPrice (for calculations), category, unitOfMeasure, stock, imageUrl, dataAiHint, description, supplierId, purchasePrice, lowStockThreshold, createdAt, updatedAt.
        - The 'price' field for display would be formatted from 'numericPrice' on retrieval.
        - Adding a product creates a new document. Editing updates it. Deleting removes it.
        - Stock levels are managed here initially but also affected by the Inventory Management module.
        - Pricing Rules (separate module) would interact with the 'numericPrice' to calculate final selling prices.
      */}
    </>
  );
}
