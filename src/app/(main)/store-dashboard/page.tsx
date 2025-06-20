
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { LayoutDashboard, ClipboardPlus, Users, PackageSearch, ReceiptText, TrendingUp, AlertTriangle, AlertCircle, Activity, BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback } from "react";
import { collection, getDocs, query, where, limit, orderBy, Timestamp, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebaseConfig';
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { AppContext, useAppContext } from '../layout'; 
import type { LedgerEntry, LedgerItem } from '../ledger/page'; 

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
    { label: "Daily Ledger Entry", href: "/ledger", icon: BookOpen, description: "Record daily sales, purchases or payments." },
    { label: "Manage Customers", href: "/customers?addNew=true", icon: Users, description: "View, add, or update customer information." },
    { label: "View Products & Stock", href: "/view-products-stock", icon: PackageSearch, description: "Check product prices, details, and current availability." },
];
const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StoreManagerDashboardPage() {
  const { toast } = useToast();
  const appContext = useAppContext(); 
  const [recentActivity, setRecentActivity] = useState<string[]>([]);
  
  const [metrics, setMetrics] = useState<Metric[]>([
    { title: "Today's Ledger Entries", value: "0", icon: ReceiptText, description: "Entries made by you today.", dataAiHint: "invoice document", isLoading: true, link: "/ledger?filter=today&manager=me" },
    { title: "Customers Added This Week", value: "0", icon: Users, description: "New customers registered by you this week.", dataAiHint: "people team", isLoading: true, link: "/customers"},
    { title: "Pending Customer Payments", value: "0", icon: ReceiptText, description: "Customer payments marked 'Pending'.", dataAiHint: "payment money", isLoading: true, link: "/payments?type=customer&status=Pending"},
    { title: "Reported Product Issues", value: "0", icon: AlertTriangle, description: "Active issues you've reported.", dataAiHint: "alert inventory", isLoading: true, link: "/view-products-stock?tab=issues" },
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
    const todayStartISO = startOfDay(today).toISOString().split('T')[0];
    const weekStartTimestamp = Timestamp.fromDate(startOfWeek(today, { weekStartsOn: 1 }));
    const weekEndTimestamp = Timestamp.fromDate(endOfWeek(today, { weekStartsOn: 1 }));

    try {
      const todaysLedgerEntriesQuery = query(collection(db, "ledgerEntries"),
        where("createdByUid", "==", currentManagerUid),
        where("date", "==", todayStartISO) 
      );
      const todaysLedgerEntriesSnapshot = await getCountFromServer(todaysLedgerEntriesQuery);
      updateMetricState("Today's Ledger Entries", { value: todaysLedgerEntriesSnapshot.data().count.toString() });

      const customersAddedQuery = query(collection(db, "customers"),
        where("createdBy", "==", currentManagerUid),
        where("createdAt", ">=", weekStartTimestamp),
        where("createdAt", "<=", weekEndTimestamp)
      );
      const customersAddedSnapshot = await getCountFromServer(customersAddedQuery);
      updateMetricState("Customers Added This Week", { value: customersAddedSnapshot.data().count.toString() });

      const pendingCustomerPaymentsQuery = query(collection(db, "payments"),
        where("type", "==", "customer"),
        where("status", "==", "Pending")
      );
      const pendingCustomerPaymentsSnapshot = await getCountFromServer(pendingCustomerPaymentsQuery);
      updateMetricState("Pending Customer Payments", {value: pendingCustomerPaymentsSnapshot.data().count.toString()});

      const reportedIssuesQuery = query(collection(db, "issueReports"),
        where("reportedByUid", "==", currentManagerUid),
        where("status", "==", "New") 
      );
      const reportedIssuesSnapshot = await getCountFromServer(reportedIssuesQuery);
      updateMetricState("Reported Product Issues", {value: reportedIssuesSnapshot.data().count.toString()});

      const recentLedgerActivityQuery = query(collection(db, "ledgerEntries"),
        where("createdByUid", "==", currentManagerUid),
        orderBy("createdAt", "desc"),
        limit(10) 
      );
      const activitySnapshot = await getDocs(recentLedgerActivityQuery);
      const activities = activitySnapshot.docs.map(doc => {
        const docData = doc.data();
        const data: LedgerEntry = {
          id: doc.id, 
          date: docData.date,
          type: docData.type,
          entryPurpose: docData.entryPurpose,
          entityType: docData.entityType,
          entityId: docData.entityId,
          entityName: docData.entityName,
          items: (docData.items || []) as LedgerItem[],
          subTotal: docData.subTotal,
          gstApplied: docData.gstApplied,
          taxAmount: docData.taxAmount,
          grandTotal: docData.grandTotal,
          paymentAmount: docData.paymentAmount,
          paymentMethod: docData.paymentMethod,
          paymentStatus: docData.paymentStatus,
          notes: docData.notes,
          createdByUid: docData.createdByUid,
          createdByName: docData.createdByName,
          createdAt: docData.createdAt,
          updatedAt: docData.updatedAt,
          updatedByUid: docData.updatedByUid,
          updatedByName: docData.updatedByName,
          originalTransactionAmount: docData.originalTransactionAmount,
          amountPaidNow: docData.amountPaidNow,
          remainingAmount: docData.remainingAmount,
          associatedPaymentRecordId: docData.associatedPaymentRecordId,
          relatedInvoiceId: docData.relatedInvoiceId,
        };
        
        let dateFormatted = "Recently";
         if (data.createdAt instanceof Timestamp) {
            dateFormatted = format(data.createdAt.toDate(), "MMM dd, HH:mm");
        } else if (typeof data.date === 'string') { 
            try { dateFormatted = format(parseISO(data.date), "MMM dd, HH:mm"); } catch (e) { /* use default */ }
        }
        
        let entryPurposeText = data.entryPurpose === "Payment Record" ? 
            (data.type === 'sale' ? 'Payment Rcvd' : 'Payment Sent') : 
            data.type.charAt(0).toUpperCase() + data.type.slice(1);

        return `${dateFormatted}: Ledger update for ${data.entityName || 'N/A'} - ${formatCurrency(data.grandTotal)} (${entryPurposeText})`;
      });
      setRecentActivity(activities);

    } catch (error: any) {
      console.error("Error fetching store manager dashboard data:", error);
      if (error.code === 'failed-precondition') {
        toast({
            title: "Database Index Required",
            description: `Dashboard data query failed. A Firestore index is needed (e.g., for 'ledgerEntries' by 'createdByUid' and 'date'/'createdAt', or 'customers' by 'createdBy' and 'createdAt'). Check browser console for a link to create it. Without these indexes, dashboard data will not load.`,
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
  }, [appContext, toast]); 

  useEffect(() => { 
    if (appContext && appContext.firebaseUser && appContext.userRole === 'store_manager') {
      fetchManagerDashboardData(); 
    } else if (appContext && appContext.firebaseUser && appContext.userRole !== 'store_manager') {
      console.warn("StoreDashboard: User is not a store manager. Data fetch skipped.");
      setIsLoadingMetrics(false);
      setIsLoadingActivity(false);
    } else {
      console.log("StoreDashboard: AppContext or firebaseUser not yet available. Waiting...");
    }
  }, [appContext, fetchManagerDashboardData]);


  if (!appContext || !appContext.firebaseUser || appContext.userRole !== 'store_manager') {
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
             <CardDescription>Latest ledger entries created by you.</CardDescription>
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
                    <p className="text-sm text-muted-foreground">You haven&apos;t created any ledger entries recently.</p>
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

