import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SlidersHorizontal, PlusCircle, Edit, Trash2 } from "lucide-react";

const pricingRules = [
  { id: "RULE001", name: "Bulk Discount - Widgets", type: "Bulk Pricing", description: "10% off for 10+ Premium Widgets", status: "Active" },
  { id: "RULE002", name: "Tiered Pricing - Gizmos", type: "Tiered Pricing", description: "$15 for 1-5, $12 for 6-10, $10 for 10+", status: "Active" },
  { id: "RULE003", name: "Volume Discount - Doodads", type: "Volume Pricing", description: "5% off orders over $200 of Doodads", status: "Inactive" },
];

export default function PricingRulesPage() {
  return (
    <>
      <PageHeader
        title="Pricing Rules Engine"
        description="Flexible pricing rules for automated tiered, bulk and volume pricing."
        icon={SlidersHorizontal}
        actions={
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New Rule
          </Button>
        }
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {pricingRules.map((rule) => (
          <Card key={rule.id} className="shadow-lg rounded-xl">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="font-headline text-foreground">{rule.name}</CardTitle>
                <CardDescription>{rule.type} - <span className={rule.status === 'Active' ? 'text-accent' : 'text-muted-foreground'}>{rule.status}</span></CardDescription>
              </div>
               <div className="flex space-x-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Edit className="h-4 w-4" />
                  <span className="sr-only">Edit Rule</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive-foreground">
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete Rule</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{rule.description}</p>
            </CardContent>
          </Card>
        ))}
         <Card className="shadow-lg rounded-xl border-dashed border-2 flex items-center justify-center hover:border-primary transition-colors cursor-pointer min-h-[150px]">
          <Button variant="ghost" className="flex flex-col items-center text-muted-foreground hover:text-primary">
            <PlusCircle className="h-8 w-8 mb-2" />
            <span>Add New Rule</span>
          </Button>
        </Card>
      </div>
    </>
  );
}
