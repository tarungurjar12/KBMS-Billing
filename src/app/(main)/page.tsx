
"use client"; // Required for useState, useEffect, and client-side interactions

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { DollarSign, Users, FileText, PackageMinus, LayoutDashboard, Package, BarChart3, TrendingUp, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { collection, getDocs, query, where, limit, orderBy, Timestamp,getCountFromServer } from 'firebase/firestore'; // Added getCountFromServer
import { db } from '@/lib/firebase/firebaseConfig';
import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';

/**
 * @fileOverview Admin Dashboard page for the KBMS Billing application.
 * Displays key business metrics, recent activity summaries, and provides quick actions
 * for administrative tasks. Data is fetched from Firebase Firestore.
 */

/**
 * Interface for dashboard metric display.
 */
interface DashboardMetric {
  title: string;
  value: string;
  change?: string; // Optional: for displaying change like "+5 this week"
  icon: React.ElementType;
  dataAiHint?: string; // For placeholder image generation assistance
  link?: string; // Optional link to related page
  isLoading: boolean;
}

// Quick actions for the admin dashboard
const quickActions = [
    { label: "Create New Invoice", href: "/create-bill", icon: FileText, description: "Generate a new GST-compliant invoice for a customer." },
    { label: "Add New Customer", href: "/customers?addNew=true", icon: Users, description: "Register a new customer profile directly." },
    { label: "Manage Products", href: "/products", icon: Package, description: "Update product database, prices, and inventory details." },
    { label: "Daily Ledger", href: "/ledger", icon: BarChart3, description: "View and manage daily sales and purchase transactions." },
    // { label: "Manage Staff", href: "/managers", icon: Users, description: "Administer Store Manager accounts and permissions." }, // Can be uncommented if needed
];

/**
 * AdminDashboardPage component.
 * Renders the main dashboard for administrative users, fetching and displaying
 * key metrics from Firebase Firestore.
 * @returns {JSX.Element} The rendered admin dashboard page.
 */
export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetric[]>([
    { title: "Total Revenue (Pending)", value: "₹0.00", icon: DollarSign, dataAiHint: "finance money", isLoading: true, link: "/billing" },
    { title: "Active Customers", value: "0", icon: Users, dataAiHint: "people team", isLoading: true, link: "/customers" },
    { title: "Pending Invoices", value: "0", icon: FileText, dataAiHint: "document paper", isLoading: true, link: "/billing?status=Pending" },
    { title: "Low Stock Items", value: "0", icon: PackageMinus, dataAiHint: "box inventory alert", isLoading: true, link: "/stock?filter=low" },
  ]);
  const [recentSales, setRecentSales] = useState<any[]>([]); // Placeholder for chart data
  const [isLoadingSalesChart, setIsLoadingSalesChart] = useState(true);

  const LOW_STOCK_THRESHOLD = 50; // Define globally or fetch from settings

  /**
   * Fetches dashboard data from Firestore.
   * Calculates total revenue, active customers, pending invoices, and low stock items.
   * Fetches recent sales for a chart (placeholder).
   */
  const fetchDashboardData = useCallback(async () => {
    // Helper function to update a specific metric
    const updateMetric = (title: string, newValue: Partial<DashboardMetric>) => {
      setMetrics(prevMetrics => 
        prevMetrics.map(m => m.title === title ? { ...m, ...newValue, isLoading: false } : m)
      );
    };

    try {
      // Fetch total number of customers
      const customersCol = collection(db, "customers");
      const customersSnapshot = await getCountFromServer(customersCol);
      updateMetric("Active Customers", { value: customersSnapshot.data().count.toString() });

      // Fetch pending invoices count and sum their totalAmount
      const pendingInvoicesQuery = query(collection(db, "invoices"), where("status", "==", "Pending"));
      const pendingInvoicesSnapshot = await getDocs(pendingInvoicesQuery);
      let totalPendingRevenue = 0;
      pendingInvoicesSnapshot.forEach(doc => {
        totalPendingRevenue += doc.data().totalAmount || 0;
      });
      updateMetric("Pending Invoices", { 
        value: pendingInvoicesSnapshot.size.toString(),
        change: `Total: ₹${totalPendingRevenue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
      });

      // Fetch low stock items count
      const lowStockQuery = query(collection(db, "products"), where("stock", "<", LOW_STOCK_THRESHOLD), where("stock", ">", 0));
      const lowStockSnapshot = await getCountFromServer(lowStockQuery);
      updateMetric("Low Stock Items", { value: lowStockSnapshot.data().count.toString() });
      
      // Placeholder for Total Revenue (e.g., sum of 'Paid' invoices)
      // This can be complex and might need a dedicated backend function or careful querying.
      // For now, setting a placeholder or fetching a limited sum.
      const paidInvoicesQuery = query(collection(db, "invoices"), where("status", "==", "Paid"), limit(100)); // Example limit
      const paidInvoicesSnapshot = await getDocs(paidInvoicesQuery);
      let totalPaidRevenue = 0;
      paidInvoicesSnapshot.forEach(doc => {
        totalPaidRevenue += doc.data().totalAmount || 0;
      });
      updateMetric("Total Revenue (Pending)", { value: `₹${totalPaidRevenue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`});


      // Fetch recent sales for chart (example: last 5 paid invoices)
      setIsLoadingSalesChart(true);
      const recentSalesQuery = query(collection(db, "invoices"), where("status", "==", "Paid"), orderBy("isoDate", "desc"), limit(5));
      const recentSalesSnapshot = await getDocs(recentSalesQuery);
      const salesData = recentSalesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          name: format(new Date(data.isoDate), "MMM dd"), // Format date for chart label
          uv: data.totalAmount, // 'uv' is a common key for Recharts
          invoice: data.invoiceNumber,
          customer: data.customerName,
        };
      });
      setRecentSales(salesData.reverse()); // Reverse to show oldest first for chart trend
      setIsLoadingSalesChart(false);

    } catch (error) {
      console.error("Error fetching dashboard data: ", error);
      // Set all metrics to error state or display a general error toast
      metrics.forEach(m => updateMetric(m.title, { value: "Error", isLoading: false }));
      setIsLoadingSalesChart(false);
    }
  }, [metrics]); // metrics in dependency array can cause re-fetch if not careful, ensure it's stable or use alternative

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, []); // Fetch data on component mount. Be cautious with dependencies here if `fetchDashboardData` isn't fully stable.

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        description="Overview of your business metrics and quick access to common tasks."
        icon={LayoutDashboard}
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title} className="shadow-lg rounded-xl hover:shadow-primary/20 transition-shadow">
             <Link href={metric.link || "#"} className={metric.link ? "" : "pointer-events-none"}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </CardTitle>
                <metric.icon className="h-5 w-5 text-primary" data-ai-hint={metric.dataAiHint} />
              </CardHeader>
              <CardContent>
                {metric.isLoading ? (
                  <div className="text-2xl font-bold font-headline text-foreground animate-pulse">Loading...</div>
                ) : (
                  <div className="text-2xl font-bold font-headline text-foreground">{metric.value}</div>
                )}
                {metric.change && !metric.isLoading && (
                  <p className="text-xs text-muted-foreground pt-1">
                    {metric.change}
                  </p>
                )}
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Sales Activity Chart Placeholder */}
        <Card className="lg:col-span-2 shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground flex items-center"><TrendingUp className="mr-2 h-6 w-6 text-primary"/>Recent Sales Activity</CardTitle>
            <CardDescription>A summary of recent sales trends. (Placeholder: Chart to be implemented)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSalesChart ? (
                 <div className="h-64 flex items-center justify-center bg-muted/30 rounded-md border border-dashed">
                    <p className="text-muted-foreground">Loading sales data...</p>
                 </div>
            ) : recentSales.length > 0 ? (
              <div className="h-64 flex items-center justify-center bg-muted/30 rounded-md border border-dashed">
                {/* Future: Replace with actual chart component using ShadCN Charts and `recentSales` data.
                    Example: <SalesChart data={recentSales} /> 
                    For now, show a placeholder or basic list.
                */}
                <p className="text-muted-foreground p-4">Sales chart data loaded ({recentSales.length} entries). Chart component to be implemented here.</p>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center bg-muted/30 rounded-md border border-dashed">
                <AlertCircle className="h-8 w-8 text-muted-foreground mr-2"/>
                <p className="text-muted-foreground">No recent sales data to display for the chart.</p>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Quick Actions Card */}
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground">Quick Actions</CardTitle>
             <CardDescription>Access common administrative tasks quickly.</CardDescription>
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
                        <p className="text-xs text-muted-foreground">Administer Store Manager accounts and permissions.</p>
                    </div>
                </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

