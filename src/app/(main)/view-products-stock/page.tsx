
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PackageSearch, Package, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const products = [
  { id: "PROD001", name: "Premium Widget", sku: "PW-001", price: "₹2,080", stock: 150, category: "Widgets", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "gadget tool", status: "In Stock" },
  { id: "PROD002", name: "Standard Gizmo", sku: "SG-002", price: "₹1,240", stock: 25, category: "Gizmos", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "device item", status: "Low Stock" },
  { id: "PROD003", name: "Luxury Doodad", sku: "LD-003", price: "₹3,995", stock: 0, category: "Doodads", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "object thing", status: "Out of Stock" },
  { id: "PROD004", name: "Basic Thingamajig", sku: "BT-004", price: "₹800", stock: 500, category: "Thingamajigs", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "item gadget", status: "In Stock" },
];


export default function ViewProductsStockPage() {
  return (
    <>
      <PageHeader
        title="View Products & Stock"
        description="Check product prices and current stock levels (Read-Only)."
        icon={PackageSearch}
      />
      <Tabs defaultValue="price_list" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-[400px] mb-4">
          <TabsTrigger value="price_list">Price List</TabsTrigger>
          <TabsTrigger value="stock_list">Stock List</TabsTrigger>
        </TabsList>
        <TabsContent value="price_list">
          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-foreground">Product Price List</CardTitle>
              <CardDescription>Complete list of products and their selling prices.</CardDescription>
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
                      <TableCell className="text-right font-semibold">{product.price}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">
                            <AlertTriangle className="mr-2 h-4 w-4" /> Report Issue
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="stock_list">
          <Card className="shadow-lg rounded-xl">
            <CardHeader>
              <CardTitle className="font-headline text-foreground">Current Stock Levels</CardTitle>
              <CardDescription>View current inventory status for all products.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Image</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="rounded-md" data-ai-hint={item.dataAiHint} />
                      </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell className="text-right font-semibold">{item.stock}</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={item.status === "In Stock" ? "default" : item.status === "Low Stock" ? "secondary" : "destructive"}
                          className={item.status === "In Stock" ? "bg-accent text-accent-foreground" : item.status === "Low Stock" ? "bg-yellow-400 text-yellow-900" : ""}
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">
                           <AlertTriangle className="mr-2 h-4 w-4" /> Report Issue
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
