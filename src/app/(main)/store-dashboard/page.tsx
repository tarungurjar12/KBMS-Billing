
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { LayoutDashboard, ClipboardPlus, Users, PackageSearch, ReceiptText, BarChart3, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
// Future: import { collection, getDocs, query, where, limit, orderBy, Timestamp } from 'firebase/firestore';
// Future: import { db, auth } from '@/lib/firebase/firebaseConfig';

/**
 * @fileOverview Store Manager Dashboard page.
 * Provides Store Managers with an overview of daily operations, key metrics, and quick actions.
 * Data is currently static and will be fetched from Firestore in a future implementation phase.
 */

interface Metric {
  title: string;
  value: string;
  dataAiHint?: string;
  icon: React.ElementType;
  description?: string;
}

// Static data for dashboard metrics. Will be replaced by dynamic data from Firestore.
const storeManagerMetrics: Metric[] = [
  { title: "Today's Bills Generated", value: "0", icon: ReceiptText, description: "Number of bills created today.", dataAiHint: "invoice document" },
  { title: "Pending Customer Payments", value: "0", icon: Users, description: "Customers with outstanding payments.", dataAiHint: "payment money" },
  { title: "Recently Added Customers", value: "0", icon: Users, description: "New customers added this week.", dataAiHint: "people team" },
  { title: "Items Requiring Action", value: "0", icon: PackageSearch, description: "Products needing attention.", dataAiHint: "alert inventory" },
];

interface QuickAction {
  label: string;
  href: string;
  icon: React.ElementType;
  description: string;
}

// Static data for quick actions.
const quickActions: QuickAction[] = [
    { label: "Create New Bill", href: "/create-bill", icon: ClipboardPlus, description: "Generate a new bill for a customer." },
    { label: "Manage Customers", href: "/customers", icon: Users, description: "View, add, or update customer information." },
    { label: "View Products & Stock", href: "/view-products-stock", icon: PackageSearch, description: "Check product prices and availability." },
];

/**
 * StoreManagerDashboardPage component.
 * Renders the main dashboard for Store Manager users.
 * @returns {JSX.Element} The rendered store manager dashboard page.
 */
export default function StoreManagerDashboardPage() {
  const [recentActivity, setRecentActivity] = useState<string[]>([]); // Placeholder for activity feed
  // Future: useState for dynamic metrics.
  // const [metrics, setMetrics] = useState(storeManagerMetrics);

  useEffect(() => {
    // const currentUserId = auth.currentUser?.uid;
    // if (!currentUserId) return;

    // Fetch recent activity data for the store manager from Firestore
    // E.g., last 5 bills created by this manager, customers added by this manager.
    // const fetchDashboardData = async () => {
        // Example: Bills created by current manager
        // const billsQuery = query(
        //   collection(db, "invoices"), 
        //   where("createdBy", "==", currentUserId), 
        //   orderBy("createdAt", "desc"), 
        //   limit(5)
        // );
        // const billsSnapshot = await getDocs(billsQuery);
        // const activities = billsSnapshot.docs.map(doc => `Bill ${doc.data().invoiceNumber} created for ${doc.data().customerName}.`);
        // setRecentActivity(activities);
        
        // Update metrics based on fetched data
        // setMetrics(prev => prev.map(m => m.title === "Today's Bills Generated" ? {...m, value: billsSnapshot.size.toString()} : m));
    // };
    // fetchDashboardData();

    // Placeholder data for now
    setRecentActivity([
      "Bill INV-XXXXXX created for Customer Y.",
      "New customer 'Anjali Sharma' added.",
      "Stock issue reported for 'Premium Widget'.",
      "Payment received for INV-YYYYYY.",
    ]);
  }, []);

  return (
    <>
      <PageHeader
        title="Store Manager Dashboard"
        description="Your daily operations hub for sales, customers, and inventory."
        icon={LayoutDashboard}
      />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {storeManagerMetrics.map((metric) => (
          <Card key={metric.title} className="shadow-lg rounded-xl hover:shadow-primary/20 transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.title}
              </CardTitle>
              <metric.icon className="h-5 w-5 text-primary" data-ai-hint={metric.dataAiHint} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-headline text-foreground">{metric.value}</div>
              {metric.description && <p className="text-xs text-muted-foreground pt-1">{metric.description}</p>}
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
          <CardContent className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => (
                <Link href={action.href} key={action.label} passHref legacyBehavior>
                    <Button variant="outline" className="w-full h-auto justify-start p-4 text-left flex items-start gap-3 hover:bg-accent/10 transition-colors group">
                        <action.icon className="h-7 w-7 text-primary mt-1 transition-transform group-hover:scale-110" />
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

       <div className="mt-8">
        <Card className="shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="font-headline text-foreground flex items-center"><TrendingUp className="mr-2 h-6 w-6 text-primary" />Recent Activity</CardTitle>
             <CardDescription>Latest interactions and tasks for your attention. (Placeholder)</CardDescription>
          </CardHeader>
          <CardContent>
             {recentActivity.length > 0 ? (
                <ul className="space-y-2">
                    {recentActivity.map((activity, index) => (
                        <li key={index} className="text-sm text-muted-foreground p-3 border-b last:border-b-0 hover:bg-muted/30 rounded-md">
                            {activity}
                        </li>
                    ))}
                </ul>
             ) : (
                <div className="h-48 flex items-center justify-center bg-muted/30 rounded-md border border-dashed">
                    <p className="text-muted-foreground">No recent activity to display.</p>
                </div>
             )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
