
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { LayoutDashboard, ClipboardPlus, Users, PackageSearch, ReceiptText, TrendingUp, AlertTriangle, AlertCircle, Activity } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback, useContext } from "react"; // Added useContext
import { collection, getDocs, query, where, limit, orderBy, Timestamp, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig'; // Removed auth, not needed here directly
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { AppContext, useAppContext } from '../layout'; // Import AppContext and useAppContext

/**
 * @fileOverview Store Manager Dashboard page.
 */

interface Metric {
  title: string;
  value: string;
  icon: React.ElementType;
  description?: string;
  dataAiHint?: string;
  link?: string;
  isLoading: boolean;
}

interface QuickAction {
  label: string;
  href: string;
  icon: React.ElementType;
  description: string;
}

const quickActions: QuickAction[] = [
    { label: "Create New Bill", href: "/create-bill", icon: ClipboardPlus, description: "Generate a new bill or invoice for a customer." },
    { label: "Manage Customers", href: "/customers?addNew=true", icon: Users, description: "View, add, or update customer information." },
    { label: "View Products & Stock", href: "/view-products-stock", icon: PackageSearch, description: "Check product prices, details, and current availability." },
];

export default function StoreManagerDashboardPage() {
  const { toast } = useToast();
  const appContext = useAppContext(); // Use context
  const [recentActivity, setRecentActivity] = useState<string[]>([]);
  // Removed local currentUser state, will use appContext.firebaseUser

  const [metrics, setMetrics] = useState<Metric[]>([
    { title: "Today's Bills Generated", value: "0", icon: ReceiptText, description: "Bills created by you today.", dataAiHint: "invoice document", isLoading: true, link: "/billing?filter=today&manager=me" },
    { title: "Customers Added This Week", value: "0", icon: Users, description: "New customers registered by you this week.", dataAiHint: "people team", isLoading: true, link: "/customers"},
    { title: "Pending Bills (Yours)", value: "0", icon: ReceiptText, description: "Your bills awaiting payment.", dataAiHint: "payment money", isLoading: true, link: "/billing?status=Pending&manager=me"},
    { title: "Reported Product Issues", value: "0", icon: AlertTriangle, description: "Issues you've reported (active).", dataAiHint: "alert inventory", isLoading: true, link: "/view-products-stock" },
  ]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);

  const fetchManagerDashboardData = useCallback(async () => {
    if (!appContext || !appContext.firebaseUser || appContext.userRole !== 'store_manager') {
      setMetrics(prevMetrics => prevMetrics.map(m => ({ ...m, isLoading: false, value: "N/A" })));
      setRecentActivity([]);
      setIsLoadingMetrics(false);
      setIsLoadingActivity(false);
      if (appContext && !appContext.firebaseUser) console.log("StoreDashboard: No firebaseUser in context yet.");
      if (appContext && appContext.userRole !== 'store_manager') console.log("StoreDashboard: User role is not store_manager.");
      return;
    }
    
    const currentManagerUid = appContext.firebaseUser.uid;

    const updateMetricState = (title: string, newValue: Partial<Metric>) => {
      setMetrics(prevMetrics =>
        prevMetrics.map(m => m.title === title ? { ...m, ...newValue, isLoading: false } : m)
      );
    };
    
    setIsLoadingMetrics(true);
    setIsLoadingActivity(true);
    setMetrics(prevMetrics => prevMetrics.map(m => ({ ...m, isLoading: true })));
    setRecentActivity([]);

    const today = new Date();
    const todayStartISO = startOfDay(today).toISOString();
    const todayEndISO = endOfDay(today).toISOString();
    const weekStartTimestamp = Timestamp.fromDate(startOfWeek(today, { weekStartsOn: 1 }));
    const weekEndTimestamp = Timestamp.fromDate(endOfWeek(today, { weekStartsOn: 1 }));

    try {
      const todaysBillsQuery = query(collection(db, "invoices"),
        where("createdBy", "==", currentManagerUid),
        where("isoDate", ">=", todayStartISO),
        where("isoDate", "<=", todayEndISO)
      );
      const todaysBillsSnapshot = await getCountFromServer(todaysBillsQuery);
      updateMetricState("Today's Bills Generated", { value: todaysBillsSnapshot.data().count.toString() });

      const customersAddedQuery = query(collection(db, "customers"),
        where("createdBy", "==", currentManagerUid),
        where("createdAt", ">=", weekStartTimestamp),
        where("createdAt", "<=", weekEndTimestamp)
      );
      const customersAddedSnapshot = await getCountFromServer(customersAddedQuery);
      updateMetricState("Customers Added This Week", { value: customersAddedSnapshot.data().count.toString() });

      const pendingBillsQuery = query(collection(db, "invoices"),
        where("createdBy", "==", currentManagerUid),
        where("status", "==", "Pending")
      );
      const pendingBillsSnapshot = await getCountFromServer(pendingBillsQuery);
      updateMetricState("Pending Bills (Yours)", {value: pendingBillsSnapshot.data().count.toString()});

      const reportedIssuesQuery = query(collection(db, "issueReports"),
        where("reportedByUid", "==", currentManagerUid),
        where("status", "==", "New") 
      );
      const reportedIssuesSnapshot = await getCountFromServer(reportedIssuesQuery);
      updateMetricState("Reported Product Issues", {value: reportedIssuesSnapshot.data().count.toString()});

      const recentActivityQuery = query(collection(db, "invoices"),
        where("createdBy", "==", currentManagerUid),
        orderBy("createdAt", "desc"),
        limit(3)
      );
      const activitySnapshot = await getDocs(recentActivityQuery);
      const activities = activitySnapshot.docs.map(doc => {
        const data = doc.data();
        let dateFormatted = "Recently";
        if (data.createdAt instanceof Timestamp) {
            dateFormatted = format(data.createdAt.toDate(), "MMM dd, HH:mm");
        } else if (typeof data.isoDate === 'string') {
            try {
                dateFormatted = format(parseISO(data.isoDate), "MMM dd, HH:mm");
            } catch (e) { /* ignore date parse error, use default */ }
        }
        return `${dateFormatted}: Bill ${data.invoiceNumber || 'N/A'} created for ${data.customerName || 'Unknown Customer'}.`;
      });
      setRecentActivity(activities);

    } catch (error: any) {
      console.error("Error fetching store manager dashboard data:", error);
      if (error.code === 'failed-precondition') {
        toast({
            title: "Database Index Required",
            description: `Dashboard data query failed. A Firestore index is needed (likely involving 'createdBy' field on 'invoices' or 'customers'). Check browser console for a link to create it. Without these indexes, dashboard data will not load.`,
            variant: "destructive", duration: 20000,
        });
      } else {
        toast({ title: "Dashboard Load Error", description: "Could not load some dashboard metrics. Please ensure all necessary Firestore indexes are created.", variant: "destructive"});
      }
      setMetrics(prevMetrics => prevMetrics.map(m => ({ ...m, value: m.isLoading ? "Error" : m.value, isLoading: false })));
      if (recentActivity.length === 0 && !isLoadingActivity) setRecentActivity(["Failed to load recent activity. Check Firestore indexes."]);
    } finally {
        setMetrics(prevMetrics => prevMetrics.map(m => ({...m, isLoading: false})));
        setIsLoadingMetrics(false);
        setIsLoadingActivity(false);
    }
  }, [appContext, toast]); // Removed isLoadingActivity from dependencies as it's set within the callback

  useEffect(() => { 
    // Fetch data only if context is available and user is a store manager
    if (appContext && appContext.firebaseUser && appContext.userRole === 'store_manager') {
      fetchManagerDashboardData(); 
    } else if (appContext && appContext.firebaseUser && appContext.userRole !== 'store_manager') {
      // This case should ideally be handled by middleware redirecting non-managers
      console.warn("StoreDashboard: User is not a store manager. Data fetch skipped.");
      setIsLoadingMetrics(false);
      setIsLoadingActivity(false);
    } else {
      // Context might not be ready yet, or user is null
      console.log("StoreDashboard: AppContext or firebaseUser not yet available. Waiting...");
    }
  }, [appContext, fetchManagerDashboardData]);


  if (!appContext || !appContext.firebaseUser || appContext.userRole !== 'store_manager') {
    // Show a minimal loading/placeholder if context isn't ready or user isn't a manager
    // This helps prevent rendering the full dashboard structure prematurely
    return (
        <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
            <Activity className="h-10 w-10 text-muted-foreground animate-spin" />
            <p className="ml-3 text-muted-foreground">Loading dashboard...</p>
        </div>
    );
  }


  return (
    <>
      <PageHeader title="Store Manager Dashboard" description="Your daily operations hub for sales, customers, and inventory management." icon={LayoutDashboard} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title} className="shadow-lg rounded-xl hover:shadow-primary/20 transition-shadow">
            <Link href={metric.link || "#"} className={metric.link ? "" : "pointer-events-none"}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{metric.title}</CardTitle>
                <metric.icon className="h-5 w-5 text-primary" data-ai-hint={metric.dataAiHint} />
              </CardHeader>
              <CardContent>
                {metric.isLoading ? <div className="text-2xl font-bold font-headline text-foreground animate-pulse">Loading...</div> : <div className="text-2xl font-bold font-headline text-foreground">{metric.value}</div>}
                {metric.description && !metric.isLoading && <p className="text-xs text-muted-foreground pt-1">{metric.description}</p>}
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground">Quick Actions</CardTitle>
             <CardDescription>Quickly access common tasks relevant to your role.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => (
                <Link href={action.href} key={action.label} passHref legacyBehavior>
                    <Button variant="outline" className="w-full h-auto justify-start p-3 text-left flex items-start gap-3 hover:bg-accent/10 transition-colors group">
                        <action.icon className="h-7 w-7 text-primary mt-1 transition-transform group-hover:scale-110 shrink-0" />
                         <div className="flex-1 min-w-0"> 
                            <span className="font-medium text-foreground block whitespace-normal break-words">{action.label}</span>
                            <p className="text-xs text-muted-foreground whitespace-normal break-words">{action.description}</p>
                        </div>
                    </Button>
                </Link>
            ))}
          </CardContent>
        </Card>
      </div>

       <div className="mt-8">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground flex items-center"><TrendingUp className="mr-2 h-6 w-6 text-primary" />Your Recent Activity</CardTitle>
             <CardDescription>Latest interactions and tasks performed by you.</CardDescription>
          </CardHeader>
          <CardContent>
             {isLoadingActivity && recentActivity.length === 0 ? ( 
                <div className="h-48 flex flex-col items-center justify-center bg-muted/30 rounded-md border border-dashed">
                    <Activity className="h-10 w-10 text-muted-foreground animate-spin mb-2" />
                    <p className="text-muted-foreground">Loading recent activity...</p>
                </div>
             ) : !isLoadingActivity && recentActivity.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center bg-muted/30 rounded-md border border-dashed">
                    <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="text-muted-foreground font-semibold">No Recent Activity</p>
                    <p className="text-sm text-muted-foreground">You haven&apos;t performed any actions recently, or data is still loading.</p>
                </div>
             ) : (
                <ul className="space-y-2">
                    {recentActivity.map((activity, index) => (
                        <li key={index} className="text-sm text-muted-foreground p-3 border-b last:border-b-0 hover:bg-muted/30 rounded-md transition-colors">
                            {activity}
                        </li>
                    ))}
                </ul>
             )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

