
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { DollarSign, Users, FileText, PackageMinus, LayoutDashboard } from "lucide-react";

const dashboardMetrics = [
  { title: "Total Revenue", value: "₹3,618,550", change: "+20.1% from last month", icon: DollarSign, dataAiHint: "finance money" },
  { title: "Active Users", value: "+2350", change: "+180.1% from last month", icon: Users, dataAiHint: "people team" },
  { title: "Pending Invoices", value: "12", change: "+5 from last week", icon: FileText, dataAiHint: "document paper" },
  { title: "Low Stock Items", value: "7", change: "Needs attention", icon: PackageMinus, dataAiHint: "box inventory" },
];

export default function AdminDashboardPage() { // Renamed for clarity, assuming this is Admin's default
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
              <metric.icon className="h-5 w-5 text-primary" />
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
            <div className="h-64 flex items-center justify-center bg-muted/50 rounded-md">
              <p className="text-muted-foreground">Sales chart will be displayed here.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground">Quick Actions</CardTitle>
             <CardDescription>Commonly used actions.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col space-y-3">
            <button className="w-full text-left p-3 rounded-md hover:bg-accent/50 transition-colors">Create New Invoice</button>
            <button className="w-full text-left p-3 rounded-md hover:bg-accent/50 transition-colors">Add New Customer</button>
            <button className="w-full text-left p-3 rounded-md hover:bg-accent/50 transition-colors">Manage Products</button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
