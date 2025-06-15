
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { LayoutDashboard, ClipboardPlus, Users, PackageSearch, ReceiptText, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, where, limit, orderBy, Timestamp, getCountFromServer } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
import type { User as FirebaseUser } from "firebase/auth";
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns'; 
import { useToast } from "@/hooks/use-toast";

/**
 * @fileOverview Store Manager Dashboard page.
 * Provides Store Managers with an overview of daily operations, key metrics relevant to them,
 * and quick actions. Data is fetched from Firebase Firestore, filtered for the current manager.
 */

/**
 * Interface for dashboard metric display.
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

/**
 * Interface for quick action button display.
 */
interface QuickAction {
  label: string;
  href: string;
  icon: React.ElementType;
  description: string;
}

// Quick actions available on the Store Manager dashboard.
const quickActions: QuickAction[] = [
    { label: "Create New Bill", href: "/create-bill", icon: ClipboardPlus, description: "Generate a new bill or invoice for a customer." },
    { label: "Manage Customers", href: "/customers?addNew=true", icon: Users, description: "View, add, or update customer information." },
    { label: "View Products & Stock", href: "/view-products-stock", icon: PackageSearch, description: "Check product prices, details, and current availability." },
];

/**
 * StoreManagerDashboardPage component.
 * Renders the main dashboard for Store Manager users, fetching and displaying
 * key metrics from Firebase Firestore tailored to their activity.
 * @returns {JSX.Element} The rendered store manager dashboard page.
 */
export default function StoreManagerDashboardPage() {
  const { toast } = useToast();
  const [recentActivity, setRecentActivity] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  // Initial state for dashboard metrics, including loading indicators.
  const [metrics, setMetrics] = useState<Metric[]>([
    { title: "Today's Bills Generated", value: "0", icon: ReceiptText, description: "Bills created by you today.", dataAiHint: "invoice document", isLoading: true, link: "/billing?filter=today&manager=me" },
    { title: "Customers Added This Week", value: "0", icon: Users, description: "New customers registered by you this week.", dataAiHint: "people team", isLoading: true, link: "/customers"},
    { title: "Pending Bills (Yours)", value: "0", icon: ReceiptText, description: "Your bills awaiting payment.", dataAiHint: "payment money", isLoading: true, link: "/billing?status=Pending&manager=me"},
    { title: "Reported Product Issues", value: "0", icon: AlertTriangle, description: "Issues you've reported (active).", dataAiHint: "alert inventory", isLoading: true, link: "/view-products-stock" }, 
  ]);

  // Subscribe to Firebase auth state changes to get the current user.
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe(); // Cleanup subscription on unmount.
  }, []);

  /**
   * Fetches all necessary data for the Store Manager dashboard from Firestore.
   * This includes metrics like bills generated, customers added, pending bills, and reported issues.
   * All queries are filtered by the current manager's UID.
   */
  const fetchManagerDashboardData = useCallback(async () => {
    if (!currentUser) {
      console.log("StoreManagerDashboard: No current user, skipping data fetch.");
      // Set metrics to N/A if no user is logged in.
      setMetrics(prevMetrics => prevMetrics.map(m => ({ ...m, isLoading: false, value: "N/A" })));
      return;
    }
    console.log("StoreManagerDashboard: Fetching data for user:", currentUser.uid);

    const today = new Date();
    const todayStartISO = startOfDay(today).toISOString();
    const todayEndISO = endOfDay(today).toISOString();
    
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Assuming week starts on Monday.
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const weekStartTimestamp = Timestamp.fromDate(weekStart);
    const weekEndTimestamp = Timestamp.fromDate(weekEnd);

    // Helper function to update a specific metric in the state.
    const updateMetric = (title: string, newValue: Partial<Metric>) => {
      setMetrics(prevMetrics => 
        prevMetrics.map(m => m.title === title ? { ...m, ...newValue, isLoading: false } : m)
      );
    };

    try {
      // 1. Today's Bills Generated by this manager
      // Firestore Index Required: 'invoices' collection, index on 'createdBy' (ASC), 'isoDate' (ASC/DESC for range).
      const todaysBillsQuery = query(
        collection(db, "invoices"), 
        where("createdBy", "==", currentUser.uid),
        where("isoDate", ">=", todayStartISO),
        where("isoDate", "<=", todayEndISO)
      );
      const todaysBillsSnapshot = await getCountFromServer(todaysBillsQuery);
      updateMetric("Today's Bills Generated", { value: todaysBillsSnapshot.data().count.toString() });

      // 2. Customers Added This Week by this manager
      // Firestore Index Required: 'customers' collection, index on 'createdBy' (ASC), 'createdAt' (ASC/DESC for range).
      const customersAddedQuery = query(
        collection(db, "customers"),
        where("createdBy", "==", currentUser.uid), 
        where("createdAt", ">=", weekStartTimestamp),
        where("createdAt", "<=", weekEndTimestamp)
      );
      const customersAddedSnapshot = await getCountFromServer(customersAddedQuery);
      updateMetric("Customers Added This Week", { value: customersAddedSnapshot.data().count.toString() });

      // 3. Pending Bills created by this manager
      // Firestore Index Required: 'invoices' collection, index on 'createdBy' (ASC), 'status' (ASC).
      const pendingBillsQuery = query(
          collection(db, "invoices"),
          where("createdBy", "==", currentUser.uid),
          where("status", "==", "Pending")
      );
      const pendingBillsSnapshot = await getCountFromServer(pendingBillsQuery);
      updateMetric("Pending Bills (Yours)", {value: pendingBillsSnapshot.data().count.toString()});

      // 4. Reported Product Issues by this manager (active issues with 'New' status)
      // Firestore Index Required: 'issueReports' collection, index on 'reportedByUid' (ASC), 'status' (ASC).
      const reportedIssuesQuery = query(
          collection(db, "issueReports"),
          where("reportedByUid", "==", currentUser.uid),
          where("status", "==", "New") 
      );
      const reportedIssuesSnapshot = await getCountFromServer(reportedIssuesQuery);
      updateMetric("Reported Product Issues", {value: reportedIssuesSnapshot.data().count.toString()});

      // Fetch recent activity (e.g., last 3 bills created by this manager)
      // Firestore Index Required: 'invoices' collection, index on 'createdBy' (ASC), 'createdAt' (DESC).
      const recentActivityQuery = query(
        collection(db, "invoices"), 
        where("createdBy", "==", currentUser.uid), 
        orderBy("createdAt", "desc"), 
        limit(3)
      );
      const activitySnapshot = await getDocs(recentActivityQuery);
      const activities = activitySnapshot.docs.map(doc => {
        const data = doc.data();
        const dateFormatted = data.createdAt instanceof Timestamp 
            ? format(data.createdAt.toDate(), "MMM dd, HH:mm") 
            : (data.isoDate ? format(new Date(data.isoDate), "MMM dd, HH:mm") : "Recently");
        return `${dateFormatted}: Bill ${data.invoiceNumber || 'N/A'} created for ${data.customerName || 'Unknown Customer'}.`;
      });
      setRecentActivity(activities);

    } catch (error: any) {
      console.error("Error fetching store manager dashboard data:", error);
      // Handle missing Firestore index error
      if (error.code === 'failed-precondition') {
        toast({
            title: "Database Index Required for Dashboard",
            description: `One or more queries for your dashboard data failed. This often means a Firestore index is missing. Please check your browser's developer console for a specific Firebase error message that includes a link to create the required index. You can also manually create indexes in the Firebase console for project '${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}'.`,
            variant: "destructive",
            duration: 20000, // Longer duration for important messages
        });
      } else {
        // Handle other types of errors
        toast({
            title: "Dashboard Load Error",
            description: "Could not load some dashboard metrics. Please try again later.",
            variant: "destructive",
        });
      }
      // Set metrics to "Error" state if fetching fails.
      metrics.forEach(m => updateMetric(m.title, { value: "Error", isLoading: false }));
      setRecentActivity(["Failed to load recent activity due to an error."]);
    }
  }, [currentUser, toast, metrics]); // metrics dependency included for updateMetric closure.

  // Fetch dashboard data when the current user is available or changes.
  useEffect(() => {
    if (currentUser) {
      fetchManagerDashboardData();
    }
  }, [currentUser, fetchManagerDashboardData]);

  return (
    <>
      <PageHeader
        title="Store Manager Dashboard"
        description="Your daily operations hub for sales, customers, and inventory management."
        icon={LayoutDashboard}
      />
      {/* Display key metrics */}
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
                {metric.description && !metric.isLoading && (
                    <p className="text-xs text-muted-foreground pt-1">{metric.description}</p>
                )}
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
      
      {/* Quick Actions Section */}
      <div className="mt-8">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground">Quick Actions</CardTitle>
             <CardDescription>Quickly access common tasks relevant to your role.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => (
                <Link href={action.href} key={action.label} passHref legacyBehavior>
                    <Button variant="outline" className="w-full h-auto justify-start p-4 text-left flex items-start gap-3 hover:bg-accent/10 transition-colors group">
                        <action.icon className="h-7 w-7 text-primary mt-1 transition-transform group-hover:scale-110 shrink-0" />
                        <div className="flex-1">
                            <span className="text-base font-medium text-foreground">{action.label}</span>
                            <p className="text-xs text-muted-foreground">{action.description}</p>
                        </div>
                    </Button>
                </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Section */}
       <div className="mt-8">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground flex items-center"><TrendingUp className="mr-2 h-6 w-6 text-primary" />Your Recent Activity</CardTitle>
             <CardDescription>Latest interactions and tasks performed by you.</CardDescription>
          </CardHeader>
          <CardContent>
             {recentActivity.length > 0 ? (
                <ul className="space-y-2">
                    {recentActivity.map((activity, index) => (
                        <li key={index} className="text-sm text-muted-foreground p-3 border-b last:border-b-0 hover:bg-muted/30 rounded-md transition-colors">
                            {activity}
                        </li>
                    ))}
                </ul>
             ) : ( 
                <div className="h-48 flex items-center justify-center bg-muted/30 rounded-md border border-dashed">
                    <p className="text-muted-foreground">{metrics.some(m=>m.isLoading) ? "Loading recent activity..." : "No recent activity to display."}</p>
                </div>
             )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

