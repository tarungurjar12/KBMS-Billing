

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Package, PlusCircle, MoreHorizontal, Edit, Trash2, PackageSearch, FileWarning } from "lucide-react"; 
import Image from "next/image"; 
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea"; 
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

export interface Product {
  id: string; 
  name: string;
  sku: string; 
  description?: string | null; 
  price: string; 
  numericPrice: number; 
  stock: number; 
  category: string; 
  unitOfMeasure: string; 
  imageUrl: string; 
  dataAiHint: string; 
  createdAt?: Timestamp; 
  updatedAt?: Timestamp; 
}

const PRODUCT_CATEGORIES = ["Widgets", "Gizmos", "Doodads", "Thingamajigs", "Electronics", "Stationery", "Software", "Apparel", "Home Goods", "Building Materials", "Pipes & Fittings", "Cement", "Bricks", "Steel Bars", "Hardware", "Tools", "Paint", "Other"];
const UNITS_OF_MEASURE = ["pcs", "kg", "meter", "sq ft", "liter", "box", "bag", "set", "dozen", "ton", "bundle", "unit", "pair", "roll", "nos"];

const productSchema = z.object({
  name: z.string().min(3, { message: "Product name must be at least 3 characters." }),
  sku: z.string().min(3, { message: "SKU must be at least 3 characters." }).regex(/^[a-zA-Z0-9-]+$/, { message: "SKU can only contain letters, numbers, and hyphens."}),
  description: z.string().optional(),
  category: z.string().min(1, { message: "Please select a product category." }),
  unitOfMeasure: z.string().min(1, { message: "Please select a unit of measure."}),
  numericPrice: z.preprocess(
    (val) => parseFloat(String(val).replace(/[^0-9.]+/g, "")), 
    z.number({invalid_type_error: "Price must be a valid number."}).positive({ message: "Price must be a positive value." })
  ),
  stock: z.preprocess(
    (val) => parseInt(String(val).replace(/[^0-9]+/g, ""), 10), 
    z.number({invalid_type_error: "Stock quantity must be a whole number."}).int().min(0, { message: "Stock quantity cannot be negative." })
  ),
  dataAiHint: z.string().min(2, {message: "Image hint must be at least 2 characters."}).max(30, {message: "Image hint too long (max 30 chars). Use 1-2 keywords."}),
});

type ProductFormValues = z.infer<typeof productSchema>;

const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
    defaultValues: { name: "", sku: "", category: PRODUCT_CATEGORIES[0] || "", unitOfMeasure: UNITS_OF_MEASURE[0] || "pcs", numericPrice: 0, stock: 0, dataAiHint: "", description: "" },
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
             description: data.description || null,
             numericPrice: data.numericPrice || 0,
             price: formatCurrency(data.numericPrice || 0),
             stock: data.stock || 0,
             category: data.category || "Other",
             unitOfMeasure: data.unitOfMeasure || "pcs",
             imageUrl: data.imageUrl || `https://placehold.co/60x60.png?text=${encodeURIComponent(data.name.substring(0,2).toUpperCase())}`,
             dataAiHint: data.dataAiHint || "product item", 
             createdAt: data.createdAt,
             updatedAt: data.updatedAt,
         } as Product;
      });
      setProductList(fetchedProducts);
    } catch (error: any) {
      console.error("Error fetching products: ", error);
       if (error.code === 'failed-precondition') {
         toast({
            title: "Database Index Required",
            description: `A query for products failed. Please create the required Firestore index for 'products' collection (orderBy 'name' ascending). Check your browser's developer console for a Firebase link to create it, or visit the Firestore indexes page in your Firebase console.`,
            variant: "destructive",
            duration: 15000,
        });
      } else {
        toast({ title: "Database Error", description: `Could not load products: ${error.message}`, variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (isFormDialogOpen) {
      if (editingProduct) {
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
      } else { 
        form.reset({ name: "", sku: "", description: "", category: PRODUCT_CATEGORIES[0] || "", unitOfMeasure: UNITS_OF_MEASURE[0] || "pcs", numericPrice: 0, stock: 0, dataAiHint: "" });
      }
    }
  }, [editingProduct, isFormDialogOpen, form]);

  const handleFormSubmit = async (values: ProductFormValues) => {
    try {
      const productDataToSave = { 
         ...values, 
         description: (values.description === undefined || values.description.trim() === "") ? null : values.description.trim(),
         imageUrl: `https://placehold.co/100x100.png?text=${encodeURIComponent(values.name.substring(0,2).toUpperCase())}`, 
      };

      if (editingProduct) { 
        const productRef = doc(db, "products", editingProduct.id);
        await updateDoc(productRef, {...productDataToSave, updatedAt: serverTimestamp()});
        toast({ title: "Product Updated", description: `Product "${values.name}" has been updated successfully.` });
      } else { 
        await addDoc(collection(db, "products"), {...productDataToSave, createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
        toast({ title: "Product Added", description: `New product "${values.name}" has been added successfully.` });
      }
      fetchProducts(); 
      setIsFormDialogOpen(false); 
      setEditingProduct(null); 
      form.reset(); 
    } catch (error: any) {
      console.error("Error saving product: ", error);
      toast({ title: "Save Error", description: `Failed to save product: ${error.message}`, variant: "destructive" });
    }
  };
  
  const openAddDialog = () => {
    setEditingProduct(null);
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
      toast({ title: "Product Deleted", description: `Product "${productToDelete.name}" has been deleted successfully.`, variant: "default" });
      fetchProducts(); 
    } catch (error: any) {
      console.error("Error deleting product: ", error);
      toast({ title: "Deletion Error", description: `Failed to delete product: ${error.message}`, variant: "destructive" });
    } finally {
      setProductToDelete(null);
      setIsDeleteConfirmOpen(false); 
    }
  };

  if (isLoading && productList.length === 0) {
    return <PageHeader title="Product Database" description="Loading product data from database..." icon={Package} />;
  }

  return (
    <>
      <PageHeader
        title="Product Database"
        description="Manage product information, pricing, and inventory levels. (Admin Only)"
        icon={Package}
        actions={<Button onClick={openAddDialog} className="mt-4 sm:mt-0"><PlusCircle className="mr-2 h-4 w-4" />Add New Product</Button>}
      />

      <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => { 
          if(!isOpen) { 
            setIsFormDialogOpen(false); 
            setEditingProduct(null); 
            form.reset(); 
          } else { 
            setIsFormDialogOpen(isOpen); 
          }
      }}>
        <DialogContent className="sm:max-w-lg"> 
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product Details" : "Add New Product"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? `Update details for "${editingProduct.name}".` : "Fill in all required product details."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-2 max-h-[75vh] overflow-y-auto pr-4"> 
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
              <FormField control={form.control} name="dataAiHint" render={({ field }) => (<FormItem><FormLabel>Image Hint</FormLabel><FormControl><Input placeholder="e.g., blue gadget or shiny pipe" {...field} /></FormControl><FormDescription>Keywords for placeholder image (e.g., &quot;steel pipe&quot;). Max 2-3 words.</FormDescription><FormMessage /></FormItem>)} />
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2 border-t -mx-6 px-6 flex flex-col sm:flex-row gap-2"> 
                <DialogClose asChild><Button type="button" variant="outline" className="w-full sm:w-auto">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting} className="w-full sm:w-auto">
                  {form.formState.isSubmitting ? (editingProduct ? "Saving..." : "Adding...") : (editingProduct ? "Save Changes" : "Add Product")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={(isOpen) => { if(!isOpen) setProductToDelete(null); setIsDeleteConfirmOpen(isOpen);}}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the product &quot;{productToDelete?.name}&quot; from the database.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => {setIsDeleteConfirmOpen(false); setProductToDelete(null);}}>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">Delete Product</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="shadow-lg rounded-xl">
        <CardHeader><CardTitle className="font-headline text-foreground">Product List</CardTitle><CardDescription>A comprehensive list of all available products from Firestore, ordered by name.</CardDescription></CardHeader>
        <CardContent>
          {isLoading && productList.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">Loading products...</div>
          ) : !isLoading && productList.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-10 text-center">
                <FileWarning className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
                <p className="text-lg sm:text-xl font-semibold text-muted-foreground">No Products Found</p>
                <p className="text-xs sm:text-sm text-muted-foreground mb-6">Get started by adding your first product to the database.</p>
                <Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" />Add New Product</Button>
            </div>
           ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader><TableRow>
                      <TableHead className="w-[40px] sm:w-[60px]">Image</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
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
                              onError={(e) => { e.currentTarget.src = `https://placehold.co/40x40.png?text=${encodeURIComponent(product.name.substring(0,2).toUpperCase())}`; }} 
                          />
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.sku}</TableCell>
                        <TableCell>{product.category}</TableCell>
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
              </div>

              {/* Mobile View */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
                {productList.map((product) => (
                  <Card key={product.id + '-mobile'} className="flex flex-col">
                    <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                      <div className="flex items-start gap-3">
                        <Image 
                            src={product.imageUrl} alt={product.name} width={48} height={48}
                            className="rounded-md object-cover border mt-1" data-ai-hint={product.dataAiHint}
                            onError={(e) => { e.currentTarget.src = `https://placehold.co/48x48.png?text=${encodeURIComponent(product.name.substring(0,2).toUpperCase())}`; }} 
                        />
                        <div>
                          <CardTitle className="text-base leading-tight">{product.name}</CardTitle>
                          <CardDescription className="text-xs">SKU: {product.sku}</CardDescription>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(product)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDeleteDialog(product)} className="text-destructive focus:text-destructive focus:bg-destructive/10"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-2 text-sm pt-0 pb-4">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Price:</span>
                        <span className="font-semibold">{product.price}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stock:</span>
                        <span className="font-semibold">{product.stock} {product.unitOfMeasure}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Category:</span>
                        <span>{product.category}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
           )}
        </CardContent>
      </Card>
    </>
  );
}

