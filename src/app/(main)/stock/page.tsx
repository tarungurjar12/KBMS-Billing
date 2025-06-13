import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Boxes, PackageSearch } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/input";

const stockItems = [
  { id: "PROD001", name: "Premium Widget", sku: "PW-001", stock: 150, status: "In Stock", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "gadget tool" },
  { id: "PROD002", name: "Standard Gizmo", sku: "SG-002", stock: 25, status: "Low Stock", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "device item" },
  { id: "PROD003", name: "Luxury Doodad", sku: "LD-003", stock: 0, status: "Out of Stock", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "object thing" },
  { id: "PROD004", name: "Basic Thingamajig", sku: "BT-004", stock: 500, status: "In Stock", imageUrl: "https://placehold.co/40x40.png", dataAiHint: "item gadget" },
];

export default function StockPage() {
  return (
    <>
      <PageHeader
        title="Stock Availability"
        description="Real-time stock level display for Store Managers."
        icon={Boxes}
      />
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="font-headline text-foreground">Current Stock Levels</CardTitle>
              <CardDescription>View current inventory status for all products.</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <PackageSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search products..." className="pl-8" />
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
                <TableHead className="text-right">Current Stock</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stockItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Image src={item.imageUrl} alt={item.name} width={40} height={40} className="rounded-md" data-ai-hint={item.dataAiHint} />
                  </TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.sku}</TableCell>
                  <TableCell className="text-right">{item.stock}</TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={item.status === "In Stock" ? "default" : item.status === "Low Stock" ? "secondary" : "destructive"}
                      className={item.status === "In Stock" ? "bg-accent text-accent-foreground" : item.status === "Low Stock" ? "bg-yellow-400 text-yellow-900" : ""}
                    >
                      {item.status}
                    </Badge>
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
