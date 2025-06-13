import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { Package, PlusCircle, MoreHorizontal } from "lucide-react";
import Image from "next/image";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const products = [
  { id: "PROD001", name: "Premium Widget", sku: "PW-001", price: "$25.99", stock: 150, category: "Widgets", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "gadget tool" },
  { id: "PROD002", name: "Standard Gizmo", sku: "SG-002", price: "$15.50", stock: 250, category: "Gizmos", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "device item" },
  { id: "PROD003", name: "Luxury Doodad", sku: "LD-003", price: "$49.95", stock: 75, category: "Doodads", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "object thing" },
  { id: "PROD004", name: "Basic Thingamajig", sku: "BT-004", price: "$9.99", stock: 500, category: "Thingamajigs", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "item gadget" },
];

export default function ProductsPage() {
  return (
    <>
      <PageHeader
        title="Product Database"
        description="Manage product information, pricing rules, and inventory levels."
        icon={Package}
        actions={
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Product
          </Button>
        }
      />
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
              {products.map((product) => (
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
