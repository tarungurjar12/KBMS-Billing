
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { DollarSign, Users, FileText, PackageMinus, LayoutDashboard, ClipboardPlus, Package } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * @fileOverview Admin Dashboard page.
 * Displays key metrics and quick actions for the Admin user.
 */

const dashboardMetrics = [
  { title: "Total Revenue", value: "₹3,618,550", change: "+20.1% from last month", icon: DollarSign, dataAiHint: "finance money" },
  { title: "Active Customers", value: "+2350", change: "+180.1% from last month", icon: Users, dataAiHint: "people team" }, // Changed from "Active Users" for clarity
  { title: "Pending Invoices", value: "12", change: "+5 from last week", icon: FileText, dataAiHint: "document paper" },
  { title: "Low Stock Items", value: "7", change: "Needs attention", icon: PackageMinus, dataAiHint: "box inventory" },
];

const quickActions = [
    { label: "Create New Invoice", href: "/billing", icon: FileText }, // Direct to billing page, create can be a button there
    { label: "Add New Customer", href: "/customers", icon: Users }, // Direct to customers, add button there
    { label: "Manage Products", href: "/products", icon: Package },
    { label: "Manage Managers", href: "/managers", icon: Users } // Placeholder until UserCog is fixed or replaced
];

/**
 * AdminDashboardPage component.
 * Renders the main dashboard for administrative users.
 */
export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        description="Overview of your business metrics and performance."
        icon={LayoutDashboard}
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {dashboardMetrics.map((metric) => (
          <Card key={metric.title} className="shadow-lg rounded-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <metric.icon className="h-5 w-5 text-primary" data-ai-hint={metric.dataAiHint} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-headline text-foreground">{metric.value}</div>
              <p className="text-xs text-muted-foreground pt-1">
                {metric.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground">Recent Sales</CardTitle>
            <CardDescription>A summary of recent sales activity.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Future: Replace with actual chart component */}
            <div className="h-64 flex items-center justify-center bg-muted/50 rounded-md">
              <p className="text-muted-foreground">Sales chart will be displayed here.</p>
            </div>
            {/* Example of placeholder for future Firebase integration: */}
            {/* // Future: Fetch recent sales data from Firestore and render chart. */}
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground">Quick Actions</CardTitle>
             <CardDescription>Commonly used actions.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col space-y-3">
             {quickActions.map((action) => (
                <Link href={action.href} key={action.label} passHref legacyBehavior>
                    <Button variant="outline" className="w-full justify-start p-3 text-left flex items-center gap-2 hover:bg-accent/50 transition-colors">
                        <action.icon className="h-5 w-5 text-primary mr-2" />
                        <span>{action.label}</span>
                    </Button>
                </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
