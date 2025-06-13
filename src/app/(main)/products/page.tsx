
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  sku: string;
  price: string; // Keep as string for display
  numericPrice: number; // For calculations
  stock: number;
  category: string;
  unitOfMeasure: string;
  imageUrl: string;
  dataAiHint: string;
}

const initialProducts: Product[] = [
  { id: "PROD001", name: "Premium Widget", sku: "PW-001", price: "₹2,080", numericPrice: 2080, stock: 150, category: "Widgets", unitOfMeasure: "pcs", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "gadget tool" },
  { id: "PROD002", name: "Standard Gizmo", sku: "SG-002", price: "₹1,240", numericPrice: 1240, stock: 250, category: "Gizmos", unitOfMeasure: "pcs", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "device item" },
  { id: "PROD003", name: "Luxury Doodad", sku: "LD-003", price: "₹3,995", numericPrice: 3995, stock: 75, category: "Doodads", unitOfMeasure: "box", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "object thing" },
  { id: "PROD004", name: "Basic Thingamajig", sku: "BT-004", price: "₹800", numericPrice: 800, stock: 500, category: "Thingamajigs", unitOfMeasure: "pcs", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "item gadget" },
];

const PRODUCT_CATEGORIES = ["Widgets", "Gizmos", "Doodads", "Thingamajigs", "Electronics", "Stationery", "Software", "Apparel", "Home Goods", "Building Materials"];
const UNITS_OF_MEASURE = ["pcs", "kg", "meter", "sq ft", "liter", "box", "bag", "set", "dozen"];


const productSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  sku: z.string().min(3, { message: "SKU must be at least 3 characters." }),
  category: z.string().min(1, { message: "Please select a category." }),
  unitOfMeasure: z.string().min(1, { message: "Please select a unit of measure."}),
  price: z.preprocess(
    (val) => parseFloat(String(val).replace(/[^0-9.-]+/g, "")),
    z.number({invalid_type_error: "Price must be a number."}).positive({ message: "Price must be a positive number." })
  ),
  stock: z.preprocess(
    (val) => parseInt(String(val), 10),
    z.number({invalid_type_error: "Stock must be a whole number."}).int().min(0, { message: "Stock cannot be negative." })
  ),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function ProductsPage() {
  const [productList, setProductList] = useState<Product[]>(initialProducts);
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
      unitOfMeasure: "pcs",
      price: 0,
      stock: 0,
    },
  });

  // Placeholder for fetching products from a data source
  // useEffect(() => {
  //   // async function fetchProducts() {
  //   //   // const fetchedProducts = await db.getProducts(); // Future cloud integration
  //   //   // setProductList(fetchedProducts);
  //   // }
  //   // fetchProducts();
  //   // For now, using initialProducts
  //    setProductList(initialProducts);
  // }, []);


  useEffect(() => {
    if (editingProduct && isEditProductDialogOpen) {
      form.reset({
        name: editingProduct.name,
        sku: editingProduct.sku,
        category: editingProduct.category,
        unitOfMeasure: editingProduct.unitOfMeasure,
        price: editingProduct.numericPrice, // Use numericPrice for form
        stock: editingProduct.stock,
      });
    } else {
      form.reset({ name: "", sku: "", category: "", unitOfMeasure: "pcs", price: 0, stock: 0 });
    }
  }, [editingProduct, isEditProductDialogOpen, form]);


  const handleAddSubmit = (values: ProductFormValues) => {
    // For future cloud integration:
    // try {
    //   const newProductData = { ...values, price: `₹${values.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, numericPrice: values.price };
    //   const createdProduct = await api.createProduct(newProductData); // Example API call
    //   setProductList((prev) => [createdProduct, ...prev]);
    // } catch (error) {
    //   toast({ title: "Error", description: "Failed to add product.", variant: "destructive" });
    //   return;
    // }

    const newId = `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newProduct: Product = {
      id: newId,
      name: values.name,
      sku: values.sku,
      price: `₹${values.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      numericPrice: values.price,
      stock: values.stock,
      category: values.category,
      unitOfMeasure: values.unitOfMeasure,
      imageUrl: "https://placehold.co/40x40.png", // Default placeholder
      dataAiHint: values.category.toLowerCase().split(" ")[0] || "product",
    };
    setProductList((prevProducts) => [newProduct, ...prevProducts]);
    toast({
      title: "Product Added",
      description: `${values.name} has been successfully added.`,
    });
    form.reset();
    setIsAddProductDialogOpen(false);
  };

  const handleEditSubmit = (values: ProductFormValues) => {
    if (!editingProduct) return;

    // For future cloud integration:
    // try {
    //   const updatedProductData = { ...editingProduct, ...values, price: `₹${values.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, numericPrice: values.price };
    //   await api.updateProduct(editingProduct.id, updatedProductData); // Example API call
    //   setProductList((prev) =>
    //     prev.map((p) => (p.id === editingProduct.id ? updatedProductData : p))
    //   );
    // } catch (error) {
    //   toast({ title: "Error", description: "Failed to update product.", variant: "destructive" });
    //   return;
    // }

    const updatedProduct: Product = {
      ...editingProduct,
      name: values.name,
      sku: values.sku,
      price: `₹${values.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
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
      title: "Product Updated",
      description: `${values.name} has been successfully updated.`,
    });
    setEditingProduct(null);
    setIsEditProductDialogOpen(false);
    form.reset();
  };
  
  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setIsEditProductDialogOpen(true);
  };

  const openDeleteDialog = (product: Product) => {
    setProductToDelete(product);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (!productToDelete) return;

    // For future cloud integration:
    // try {
    //   await api.deleteProduct(productToDelete.id); // Example API call
    //   setProductList((prev) => prev.filter((p) => p.id !== productToDelete.id));
    // } catch (error) {
    //   toast({ title: "Error", description: "Failed to delete product.", variant: "destructive" });
    //   return;
    // }

    setProductList((prevProducts) => prevProducts.filter((p) => p.id !== productToDelete.id));
    toast({
      title: "Product Deleted",
      description: `${productToDelete.name} has been successfully deleted.`,
      variant: "destructive"
    });
    setProductToDelete(null);
    setIsDeleteConfirmOpen(false);
  };


  return (
    <>
      <PageHeader
        title="Product Database"
        description="Manage product information, pricing rules, and inventory levels."
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
        <DialogContent className="sm:max-w-[520px]"> {/* Increased width for more fields */}
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Fill in the details below to add a new product to the database.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Super Widget X" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU (Stock Keeping Unit)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., SWX-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {PRODUCT_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                                {category}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="unitOfMeasure"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Unit of Measure</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a unit" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {UNITS_OF_MEASURE.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                                {unit}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="e.g., 1999" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Stock Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
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
            <DialogDescription>
              Update the details for &quot;{editingProduct?.name}&quot;.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
            <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Super Widget X" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU (Stock Keeping Unit)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., SWX-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {PRODUCT_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                                {category}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="unitOfMeasure"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Unit of Measure</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a unit" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {UNITS_OF_MEASURE.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                                {unit}
                            </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="e.g., 1999" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock Quantity</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="pt-4 sticky bottom-0 bg-background pb-2">
                 <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={() => { setIsEditProductDialogOpen(false); setEditingProduct(null); }}>
                      Cancel
                    </Button>
                  </DialogClose>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the product &quot;{productToDelete?.name}&quot; from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
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
                    <Image src={product.imageUrl} alt={product.name} width={40} height={40} className="rounded-md" data-ai-hint={product.dataAiHint} />
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
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(product)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Product
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openDeleteDialog(product)} className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Product
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* Comment for future data persistence:
          The 'productList' state is currently managed locally.
          In a production environment with cloud integration (e.g., Firebase Firestore):
          - Products would be fetched from the database in useEffect.
          - Add, edit, delete operations would call API endpoints that interact with the cloud database.
          - Example: `await firestore.collection('products').add(newProductData);`
          - Example: `await firestore.collection('products').doc(productId).update(updatedData);`
      */}
    </>
  );
}

    