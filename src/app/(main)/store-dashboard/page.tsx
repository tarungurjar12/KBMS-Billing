
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { LayoutDashboard, ClipboardPlus, Users, PackageSearch } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const storeManagerMetrics = [
  { title: "Today's Sales (Bills Generated)", value: "5", dataAiHint: "sales chart" },
  { title: "Pending Customer Payments", value: "3", dataAiHint: "payment money" },
  { title: "Recently Added Customers", value: "2", dataAiHint: "people team" },
];

const quickActions = [
    { label: "Create New Bill", href: "/create-bill", icon: ClipboardPlus },
    { label: "View Customers", href: "/customers", icon: Users },
    { label: "Check Products & Stock", href: "/view-products-stock", icon: PackageSearch },
]

export default function StoreManagerDashboardPage() {
  return (
    <>
      <PageHeader
        title="Store Manager Dashboard"
        description="Your daily operations hub."
        icon={LayoutDashboard}
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {storeManagerMetrics.map((metric) => (
          <Card key={metric.title} className="shadow-lg rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              {/* Optional: Add icons later based on dataAiHint if needed */}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-headline text-foreground">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-8">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground">Quick Actions</CardTitle>
             <CardDescription>Quickly access common tasks.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => (
                <Link href={action.href} key={action.label} passHref legacyBehavior>
                    <Button variant="outline" className="w-full h-auto justify-start p-4 text-left flex items-center gap-3 hover:bg-accent/50 transition-colors">
                        <action.icon className="h-6 w-6 text-primary" />
                        <span className="text-base font-medium">{action.label}</span>
                    </Button>
                </Link>
            ))}
          </CardContent>
        </Card>
      </div>
       <div className="mt-8">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground">Recent Activity</CardTitle>
             <CardDescription>Latest bills and customer interactions.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="h-48 flex items-center justify-center bg-muted/50 rounded-md">
                <p className="text-muted-foreground">Recent activity feed will be displayed here.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
