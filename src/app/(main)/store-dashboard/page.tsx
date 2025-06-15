
"use client"; // For client-side navigation and potential future data fetching

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { LayoutDashboard, ClipboardPlus, Users, PackageSearch, ReceiptText, BarChart3 } from "lucide-react"; // Added new icons
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

/**
 * @fileOverview Store Manager Dashboard page.
 * Provides Store Managers with an overview of daily operations, key metrics, and quick actions.
 */

interface Metric {
  title: string;
  value: string;
  dataAiHint?: string; // For placeholder image generation hints if we use images
  icon: React.ElementType;
  description?: string;
}

const storeManagerMetrics: Metric[] = [
  { title: "Today's Bills Generated", value: "5", icon: ReceiptText, description: "Number of bills created today.", dataAiHint: "invoice document" },
  { title: "Pending Customer Payments", value: "3", icon: Users, description: "Customers with outstanding payments.", dataAiHint: "payment money" },
  { title: "Recently Added Customers", value: "2", icon: Users, description: "New customers added today/this week.", dataAiHint: "people team" },
  { title: "Items Requiring Action", value: "1", icon: PackageSearch, description: "Products needing attention (e.g., stock issues reported).", dataAiHint: "alert inventory" },
];

interface QuickAction {
  label: string;
  href: string;
  icon: React.ElementType;
  description: string;
}

const quickActions: QuickAction[] = [
    { label: "Create New Bill", href: "/create-bill", icon: ClipboardPlus, description: "Generate a new bill for a customer." },
    { label: "Manage Customers", href: "/customers", icon: Users, description: "View, add, or update customer information." },
    { label: "View Products & Stock", href: "/view-products-stock", icon: PackageSearch, description: "Check product prices and availability." },
]

/**
 * StoreManagerDashboardPage component.
 * Renders the main dashboard for Store Manager users.
 */
export default function StoreManagerDashboardPage() {
  const [recentActivity, setRecentActivity] = useState<string[]>([]); // Placeholder for activity feed

  useEffect(() => {
    // Future: Fetch recent activity data for the store manager from Firestore
    // e.g., last 5 bills created, customers added by this manager.
    // For now, using placeholder data.
    setRecentActivity([
      "Bill INV00X created for Customer Y.",
      "New customer 'Anjali Sharma' added.",
      "Stock issue reported for 'Premium Widget'.",
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
          <Card key={metric.title} className="shadow-lg rounded-xl">
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
                    <Button variant="outline" className="w-full h-auto justify-start p-4 text-left flex items-center gap-3 hover:bg-accent/50 transition-colors group">
                        <action.icon className="h-7 w-7 text-primary transition-transform group-hover:scale-110" />
                        <div>
                            <span className="text-base font-medium">{action.label}</span>
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
            <CardTitle className="font-headline text-foreground">Recent Activity</CardTitle>
             <CardDescription>Latest bills and customer interactions for your attention.</CardDescription>
          </CardHeader>
          <CardContent>
             {recentActivity.length > 0 ? (
                <ul className="space-y-2">
                    {recentActivity.map((activity, index) => (
                        <li key={index} className="text-sm text-muted-foreground p-2 border-b last:border-b-0">
                            {activity}
                        </li>
                    ))}
                </ul>
             ) : (
                <div className="h-48 flex items-center justify-center bg-muted/50 rounded-md">
                    <p className="text-muted-foreground">No recent activity to display.</p>
                </div>
             )}
             {/* 
                Phase 1 Data Storage: Recent activity is local static data.
                Phase 2 (Future-Ready):
                - Recent activity would be fetched from Firestore.
                - This could involve querying 'bills', 'customers', or a dedicated 'activityLog' collection,
                  filtered by the current store/manager if applicable, and ordered by timestamp.
             */}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
