
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CreateBillPage() {
  return (
    <>
      <PageHeader
        title="Create New Bill"
        description="Generate a new bill for a customer."
        icon={ClipboardPlus}
      />
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Bill Creation Form</CardTitle>
          <CardDescription>Select customer, add products, and generate the bill.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-foreground mb-2">Customer Selection</h3>
              <div className="p-6 bg-muted/50 rounded-md text-center">
                <p className="text-muted-foreground">Customer selection component will be here.</p>
                <Button variant="outline" className="mt-2">Add New Customer</Button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-foreground mb-2">Product Addition</h3>
              <div className="p-6 bg-muted/50 rounded-md text-center">
                <p className="text-muted-foreground">Product search and quantity input will be here.</p>
              </div>
            </div>
             <div>
              <h3 className="text-lg font-medium text-foreground mb-2">Bill Summary</h3>
              <div className="p-6 bg-muted/50 rounded-md text-center">
                <p className="text-muted-foreground">Bill total and items summary will be here.</p>
              </div>
            </div>
            <div className="flex justify-end">
                <Button size="lg">Generate Bill</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
