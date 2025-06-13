
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Package, PlusCircle, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const initialProducts = [
  { id: "PROD001", name: "Premium Widget", sku: "PW-001", price: "₹2,080", stock: 150, category: "Widgets", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "gadget tool" },
  { id: "PROD002", name: "Standard Gizmo", sku: "SG-002", price: "₹1,240", stock: 250, category: "Gizmos", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "device item" },
  { id: "PROD003", name: "Luxury Doodad", sku: "LD-003", price: "₹3,995", stock: 75, category: "Doodads", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "object thing" },
  { id: "PROD004", name: "Basic Thingamajig", sku: "BT-004", price: "₹800", stock: 500, category: "Thingamajigs", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "item gadget" },
];

const PRODUCT_CATEGORIES = ["Widgets", "Gizmos", "Doodads", "Thingamajigs", "Electronics", "Stationery", "Software", "Apparel", "Home Goods"];

const productSchema = z.object({
  name: z.string().min(3, { message: "Name must be at least 3 characters." }),
  sku: z.string().min(3, { message: "SKU must be at least 3 characters." }),
  category: z.string().min(1, { message: "Please select a category." }),
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
  const [productList, setProductList] = useState(initialProducts);
  const [isAddProductDialogOpen, setIsAddProductDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      sku: "",
      category: "",
      price: 0,
      stock: 0,
    },
  });

  const onSubmit = (values: ProductFormValues) => {
    const newId = `PROD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newProduct = {
      id: newId,
      name: values.name,
      sku: values.sku,
      price: `₹${values.price.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      stock: values.stock,
      category: values.category,
      imageUrl: "https://placehold.co/40x40.png",
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

  return (
    <>
      <Dialog open={isAddProductDialogOpen} onOpenChange={setIsAddProductDialogOpen}>
        <PageHeader
          title="Product Database"
          description="Manage product information, pricing rules, and inventory levels."
          icon={Package}
          actions={
            <DialogTrigger asChild>
              <Button onClick={() => setIsAddProductDialogOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add New Product
              </Button>
            </DialogTrigger>
          }
        />
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Fill in the details below to add a new product to the database.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 1999" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
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
                        <Input type="number" placeholder="e.g., 100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter className="pt-4">
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
                        <DropdownMenuItem>Edit Product</DropdownMenuItem>
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Adjust Stock</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive hover:text-destructive-foreground focus:text-destructive-foreground">Delete Product</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
