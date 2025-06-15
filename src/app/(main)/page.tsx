
"use client"; 

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { DollarSign, Users, FileText, PackageMinus, LayoutDashboard, Package, BarChart3, TrendingUp, AlertCircle, Activity } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { collection, getDocs, query, where, limit, orderBy, Timestamp, getCountFromServer } from 'firebase/firestore'; 
import { db } from '@/lib/firebase/firebaseConfig';
import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

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
  change?: string; 
  icon: React.ElementType;
  dataAiHint?: string; 
  link?: string; 
  isLoading: boolean;
}

// Quick actions for the admin dashboard
const quickActions = [
    { label: "Create New Invoice", href: "/create-bill", icon: FileText, description: "Generate a new GST-compliant invoice for a customer." },
    { label: "Add New Customer", href: "/customers?addNew=true", icon: Users, description: "Register a new customer profile directly." },
    { label: "Manage Products", href: "/products", icon: Package, description: "Update product database, prices, and inventory details." },
    { label: "Daily Ledger", href: "/ledger", icon: BarChart3, description: "View and manage daily sales and purchase transactions." },
];

/**
 * AdminDashboardPage component.
 * Renders the main dashboard for administrative users, fetching and displaying
 * key metrics from Firebase Firestore.
 * @returns {JSX.Element} The rendered admin dashboard page.
 */
export default function AdminDashboardPage() {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<DashboardMetric[]>([
    { title: "Total Revenue (Paid Invoices Sample)", value: "₹0.00", icon: DollarSign, dataAiHint: "finance money", isLoading: true, link: "/billing?status=Paid" },
    { title: "Active Customers", value: "0", icon: Users, dataAiHint: "people team", isLoading: true, link: "/customers" },
    { title: "Pending Invoices", value: "0", icon: FileText, dataAiHint: "document paper", isLoading: true, link: "/billing?status=Pending" },
    { title: "Low Stock Items", value: "0", icon: PackageMinus, dataAiHint: "box inventory alert", isLoading: true, link: "/stock?filter=low" },
  ]);
  const [recentSales, setRecentSales] = useState<any[]>([]); 
  const [isLoadingSalesChart, setIsLoadingSalesChart] = useState(true);

  const LOW_STOCK_THRESHOLD = 50; 

  const fetchDashboardData = useCallback(async () => {
    // Helper to update metrics state immutably
    const updateMetric = (title: string, newValue: Partial<DashboardMetric>) => {
      setMetrics(prevMetrics => 
        prevMetrics.map(m => m.title === title ? { ...m, ...newValue, isLoading: false } : m)
      );
    };
    
    // Reset loading states for all metrics before fetching
    setMetrics(prevMetrics => prevMetrics.map(m => ({ ...m, isLoading: true })));
    setIsLoadingSalesChart(true);

    try {
      // Fetch total number of customers
      // Firestore Index: 'customers' (simple count, no specific index needed unless collection is huge)
      const customersCol = collection(db, "customers");
      const customersSnapshot = await getCountFromServer(customersCol);
      updateMetric("Active Customers", { value: customersSnapshot.data().count.toString() });

      // Fetch pending invoices count and sum their totalAmount
      // Firestore Index Required: 'invoices' collection, index on 'status' (ASC)
      const pendingInvoicesQuery = query(collection(db, "invoices"), where("status", "==", "Pending"));
      const pendingInvoicesSnapshot = await getDocs(pendingInvoicesQuery);
      let totalPendingRevenue = 0;
      pendingInvoicesSnapshot.forEach(doc => {
        totalPendingRevenue += doc.data().totalAmount || 0;
      });
      updateMetric("Pending Invoices", { 
        value: pendingInvoicesSnapshot.size.toString(),
        change: `Total Value: ₹${totalPendingRevenue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
      });

      // Fetch low stock items count
      // Firestore Index Required: 'products' collection, index on 'stock' (ASC) for range queries
      const lowStockQuery = query(collection(db, "products"), where("stock", "<", LOW_STOCK_THRESHOLD), where("stock", ">", 0));
      const lowStockSnapshot = await getCountFromServer(lowStockQuery);
      updateMetric("Low Stock Items", { value: lowStockSnapshot.data().count.toString() });
      
      // Fetch a sample of total revenue from recently paid invoices
      // Firestore Index Required: 'invoices' collection, index on 'status' (ASC) and 'isoDate' (DESC).
      const paidInvoicesQuery = query(collection(db, "invoices"), where("status", "==", "Paid"), orderBy("isoDate", "desc"), limit(100)); 
      const paidInvoicesSnapshot = await getDocs(paidInvoicesQuery);
      let totalPaidRevenue = 0;
      paidInvoicesSnapshot.forEach(doc => {
        totalPaidRevenue += doc.data().totalAmount || 0;
      });
      updateMetric("Total Revenue (Paid Invoices Sample)", { value: `₹${totalPaidRevenue.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`});

      // Fetch recent sales for chart (example: last 5 paid invoices)
      // Firestore Index Required: 'invoices' collection, index on 'status' (ASC) and 'isoDate' (DESC).
      const recentSalesQuery = query(collection(db, "invoices"), where("status", "==", "Paid"), orderBy("isoDate", "desc"), limit(5));
      const recentSalesSnapshot = await getDocs(recentSalesQuery);
      const salesData = recentSalesSnapshot.docs.map(doc => {
        const data = doc.data();
        let formattedDate = "Invalid Date";
        try {
          if (data.isoDate) { 
            const dateObj = (data.isoDate instanceof Timestamp) ? data.isoDate.toDate() : new Date(data.isoDate);
            formattedDate = format(dateObj, "MMM dd");
          }
        } catch (e) {
          console.warn("Error formatting date for recent sales chart item:", data.isoDate, e);
        }
        return {
          name: formattedDate, 
          uv: data.totalAmount || 0, 
          invoice: data.invoiceNumber || "N/A",
          customer: data.customerName || "N/A",
        };
      });
      setRecentSales(salesData.reverse()); 
      
    } catch (error: any) {
      console.error("Error fetching dashboard data: ", error);
      if (error.code === 'failed-precondition') {
        toast({
            title: "Database Index Required",
            description: `A query for dashboard data failed. Please create the required Firestore index. Check your browser's developer console for a Firebase error message that includes a link to create the required index (e.g., for 'invoices' collection: status ASC, isoDate DESC). You can also create indexes manually in your Firebase console.`,
            variant: "destructive",
            duration: 20000,
        });
      } else {
        toast({
            title: "Dashboard Load Error",
            description: "Could not load some dashboard metrics. Please try again later.",
            variant: "destructive",
        });
      }
      // Ensure all metrics show error and stop loading if general fetch fails
      setMetrics(prevMetrics => 
        prevMetrics.map(m => ({ ...m, value: m.isLoading ? "Error" : m.value, isLoading: false }))
      );
    } finally {
      // Ensure all individual metric loading states are false even if some succeed and others fail before a general catch
      setMetrics(prevMetrics => prevMetrics.map(m => ({...m, isLoading: false})));
      setIsLoadingSalesChart(false);
    }
  }, [toast]); // Removed 'metrics' from dependencies

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]); 

  return (
    <>
      <PageHeader
        title="Admin Dashboard"
        description="Key business metrics and quick access to common tasks."
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
        <Card className="lg:col-span-2 shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground flex items-center"><TrendingUp className="mr-2 h-6 w-6 text-primary"/>Recent Sales Activity</CardTitle>
            <CardDescription>A visual summary of recent sales trends from paid invoices.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSalesChart ? (
                 <div className="h-64 flex items-center justify-center bg-muted/30 rounded-md border border-dashed">
                    <Activity className="h-10 w-10 text-muted-foreground animate-spin mr-3" />
                    <p className="text-muted-foreground">Loading sales data for chart...</p>
                 </div>
            ) : recentSales.length > 0 ? (
              <div className="h-64 flex items-center justify-center bg-muted/20 dark:bg-muted/10 rounded-md border border-dashed">
                {/* Placeholder for actual chart component */}
                <p className="text-muted-foreground p-4 text-center">Sales chart data loaded ({recentSales.length} entries).<br/> Actual chart component to be implemented here.</p>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center bg-muted/30 rounded-md border border-dashed">
                <AlertCircle className="h-8 w-8 text-muted-foreground mr-2"/>
                <p className="text-muted-foreground">No recent sales data available to display.</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground">Quick Actions</CardTitle>
             <CardDescription>Access common administrative tasks efficiently.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col space-y-3">
             {quickActions.map((action) => (
                <Link href={action.href} key={action.label} passHref legacyBehavior>
                    <Button variant="outline" className="w-full h-auto justify-start p-3 text-left flex items-start gap-3 hover:bg-accent/10 transition-colors group">
                        <action.icon className="h-6 w-6 text-primary mt-1 transition-transform group-hover:scale-110 shrink-0" />
                        <div className="flex-1">
                            <span className="font-medium text-foreground">{action.label}</span>
                            <p className="text-xs text-muted-foreground">{action.description}</p>
                        </div>
                    </Button>
                </Link>
            ))}
             <Link href="/managers" passHref legacyBehavior>
                <Button variant="outline" className="w-full h-auto justify-start p-3 text-left flex items-start gap-3 hover:bg-accent/10 transition-colors group">
                    <Users className="h-6 w-6 text-primary mt-1 transition-transform group-hover:scale-110 shrink-0" /> {/* Changed from UserCog to Users for consistency */}
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
