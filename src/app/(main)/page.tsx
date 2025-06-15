
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { DollarSign, Users, FileText, PackageMinus, LayoutDashboard, Package, BarChart3, TrendingUp } from "lucide-react"; // Added BarChart3, TrendingUp
import Link from "next/link";
import { Button } from "@/components/ui/button";
// Future: import { collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
// Future: import { db } from '@/lib/firebase/firebaseConfig';
// Future: import { useEffect, useState } from 'react';

/**
 * @fileOverview Admin Dashboard page for the KBMS Billing application.
 * Displays key business metrics, recent activity summaries, and provides quick actions
 * for administrative tasks. Data is currently static and will be fetched from Firestore
 * in a future implementation phase.
 */

// Static data for dashboard metrics. Will be replaced by dynamic data from Firestore.
const dashboardMetrics = [
  { title: "Total Revenue", value: "₹0.00", change: "Loading...", icon: DollarSign, dataAiHint: "finance money" },
  { title: "Active Customers", value: "0", change: "Loading...", icon: Users, dataAiHint: "people team" },
  { title: "Pending Invoices", value: "0", change: "Loading...", icon: FileText, dataAiHint: "document paper" },
  { title: "Low Stock Items", value: "0", change: "Loading...", icon: PackageMinus, dataAiHint: "box inventory" },
];

// Static data for quick actions.
const quickActions = [
    { label: "Create New Invoice", href: "/create-bill", icon: FileText, description: "Generate a new GST-compliant invoice." },
    { label: "Add New Customer", href: "/customers", icon: Users, description: "Register a new customer profile." },
    { label: "Manage Products", href: "/products", icon: Package, description: "Update product database and inventory." },
    { label: "Daily Ledger", href: "/ledger", icon: BarChart3, description: "View and manage daily transactions." },
];

/**
 * AdminDashboardPage component.
 * Renders the main dashboard for administrative users.
 * 
 * @returns {JSX.Element} The rendered admin dashboard page.
 */
export default function AdminDashboardPage() {
  // Future: useState for dynamic metrics, useEffect to fetch data from Firestore.
  // const [metrics, setMetrics] = useState(dashboardMetrics);
  // const [recentSales, setRecentSales] = useState([]); // For chart

  // useEffect(() => {
  //   const fetchDashboardData = async () => {
  //     // Fetch total revenue, active customers, pending invoices, low stock items from Firestore
  //     // Example: const invoicesSnapshot = await getDocs(query(collection(db, "invoices"), where("status", "==", "Pending")));
  //     // setMetrics(prev => prev.map(m => m.title === "Pending Invoices" ? {...m, value: invoicesSnapshot.size.toString()} : m));
  //     // Fetch recent sales for the chart
  //   };
  //   fetchDashboardData();
  // }, []);

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        description="Overview of your business metrics and performance."
        icon={LayoutDashboard}
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {dashboardMetrics.map((metric) => (
          <Card key={metric.title} className="shadow-lg rounded-xl hover:shadow-primary/20 transition-shadow">
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
            <CardTitle className="font-headline text-foreground flex items-center"><TrendingUp className="mr-2 h-6 w-6 text-primary"/>Recent Sales Activity</CardTitle>
            <CardDescription>A summary of sales trends over the past month. (Placeholder)</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Future: Replace with actual chart component using ShadCN Charts and data from Firestore */}
            <div className="h-64 flex items-center justify-center bg-muted/30 rounded-md border border-dashed">
              <p className="text-muted-foreground">Sales chart will be displayed here.</p>
            </div>
            {/* 
              Phase 2 (Future-Ready):
              - Fetch recent sales data from 'invoices' or 'ledgerEntries' collection in Firestore.
              - Aggregate data (e.g., daily or weekly sales totals).
              - Use a charting library (like Recharts, integrated via ShadCN Charts) to visualize this data.
              - Example data points: date, totalSalesAmount.
            */}
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground">Quick Actions</CardTitle>
             <CardDescription>Access common tasks quickly.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col space-y-3">
             {quickActions.map((action) => (
                <Link href={action.href} key={action.label} passHref legacyBehavior>
                    <Button variant="outline" className="w-full h-auto justify-start p-3 text-left flex items-start gap-3 hover:bg-accent/10 transition-colors group">
                        <action.icon className="h-6 w-6 text-primary mt-1 transition-transform group-hover:scale-110" />
                        <div className="flex-1">
                            <span className="font-medium text-foreground">{action.label}</span>
                            <p className="text-xs text-muted-foreground">{action.description}</p>
                        </div>
                    </Button>
                </Link>
            ))}
             <Link href="/managers" passHref legacyBehavior>
                <Button variant="outline" className="w-full h-auto justify-start p-3 text-left flex items-start gap-3 hover:bg-accent/10 transition-colors group">
                    <Users className="h-6 w-6 text-primary mt-1 transition-transform group-hover:scale-110" />
                    <div className="flex-1">
                        <span className="font-medium text-foreground">Manage Staff</span>
                        <p className="text-xs text-muted-foreground">Administer Store Manager accounts.</p>
                    </div>
                </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
