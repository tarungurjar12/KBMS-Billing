import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Truck, PlusCircle } from "lucide-react";

export default function ManageSellersPage() {
  return (
    <>
      <PageHeader
        title="Manage Sellers"
        description="Administer seller/supplier accounts and information."
        icon={Truck}
        actions={
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Seller
          </Button>
        }
      />
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Seller List</CardTitle>
          <CardDescription>A list of all registered sellers/suppliers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-md">
            <p className="text-muted-foreground">Seller list and management tools will be displayed here.</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
