
"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, FileWarning, CheckCheck, CheckSquare, Loader2, GitPullRequest, Eye, X, ThumbsUp, ThumbsDown, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, Timestamp, writeBatch, addDoc, serverTimestamp, getDoc, runTransaction, deleteDoc } from 'firebase/firestore';
import type { DocumentSnapshot, DocumentData, DocumentReference } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
import type { User as FirebaseUser } from "firebase/auth";
import Link from "next/link";
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Button } from "@/components/ui/button";
import { useAppContext } from '../layout';
import type { LedgerEntry, LedgerItem } from '../ledger/page';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

/**
 * @fileOverview Notifications center page.
 */

export interface Notification {
  id: string;
  recipientUid: string;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: Timestamp;
  type?: 'issue_report' | 'issue_resolved' | 'generic' | 'update_request' | 'update_approved' | 'update_declined' | 'delete_request' | 'delete_approved' | 'delete_declined';
  relatedDocId?: string; 
  originatorUid?: string;
  originatorName?: string;
  productName?: string;
}

interface UpdateRequest {
    id: string;
    requestType: 'update' | 'delete';
    originalLedgerEntryId: string;
    originalData: LedgerEntry;
    updatedData?: any;
    requestedByUid: string;
    requestedByName: string;
    requestedAt: Timestamp;
    status: 'pending' | 'approved' | 'declined';
    reviewedByUid?: string;
    reviewedAt?: Timestamp;
}

const formatCurrency = (num: number): string => `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getChangedFields = (original: any, updated: any) => {
    const changes: { key: string; oldValue: any; newValue: any }[] = [];
    if (!original || !updated) return changes;
    const allKeys = new Set([...Object.keys(original), ...Object.keys(updated)]);

    allKeys.forEach(key => {
        if (key === 'items' || key === 'createdAt' || key === 'updatedAt' || key === 'id') return;
        const originalValue = original[key];
        const updatedValue = updated[key];
        if (JSON.stringify(originalValue) !== JSON.stringify(updatedValue)) {
            changes.push({ key: key, oldValue: originalValue, newValue: updatedValue });
        }
    });
    return changes;
};

export default function NotificationsPage() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const { userRole } = useAppContext();
  
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedUpdateRequest, setSelectedUpdateRequest] = useState<UpdateRequest | null>(null);
  const [isLoadingReviewData, setIsLoadingReviewData] = useState(false);
  const [selectedNotificationForReview, setSelectedNotificationForReview] = useState<Notification | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      if (!user) {
        setIsLoading(false);
        setNotifications([]);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    setIsLoading(true);
    const q = query(collection(db, "notifications"), where("recipientUid", "==", currentUser.uid), orderBy("createdAt", "desc"));
    const unsubscribeFirestore = onSnapshot(q, (querySnapshot) => {
      const fetchedNotifications = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setNotifications(fetchedNotifications);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching notifications: ", error);
      toast({ title: "Database Error", description: "Could not load notifications in real-time.", variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribeFirestore();
  }, [currentUser, toast]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (!currentUser) return;
    const unreadNotifications = notifications.filter(n => !n.isRead);
    if (unreadNotifications.length === 0) {
        toast({title: "No unread notifications", description: "Everything is already marked as read."});
        return;
    }
    try {
        const batch = writeBatch(db);
        unreadNotifications.forEach(notif => {
            const notifRef = doc(db, "notifications", notif.id);
            batch.update(notifRef, { isRead: true });
        });
        await batch.commit();
        toast({title: "Success", description: "All notifications marked as read."});
    } catch (error) {
        console.error("Error marking all as read:", error);
        toast({title: "Error", description: "Could not mark all notifications as read.", variant: "destructive"});
    }
  }, [currentUser, notifications, toast]);

  const handleMarkAsResolved = useCallback(async (notification: Notification) => {
    if (userRole !== 'admin' || !notification.relatedDocId || !notification.originatorUid) {
        toast({ title: "Permission Denied", description: "Only admins can resolve issues.", variant: "destructive" });
        return;
    }

    setResolvingId(notification.id);
    try {
        const batch = writeBatch(db);
        const issueReportRef = doc(db, "issueReports", notification.relatedDocId);
        batch.update(issueReportRef, { status: 'Resolved' });
        const adminNotifRef = doc(db, "notifications", notification.id);
        batch.update(adminNotifRef, { isRead: true, title: `[Resolved] ${notification.title}` });
        const managerNotifRef = doc(collection(db, "notifications"));
        batch.set(managerNotifRef, {
            recipientUid: notification.originatorUid,
            title: `Issue Resolved: ${notification.productName || 'Product Issue'}`,
            message: `The issue you reported for "${notification.productName || 'a product'}" has been marked as resolved by an admin.`,
            link: notification.link, isRead: false, createdAt: serverTimestamp(), type: 'issue_resolved',
            relatedDocId: notification.relatedDocId,
        });
        await batch.commit();
        toast({ title: "Issue Resolved", description: "The issue has been marked as resolved and the manager has been notified." });
    } catch (error: any) {
        console.error("Error resolving issue:", error);
        toast({ title: "Error", description: "Could not resolve the issue. Please try again.", variant: "destructive" });
    } finally {
        setResolvingId(null);
    }
  }, [userRole, toast]);

  const openReviewDialog = useCallback(async (notification: Notification) => {
      if (!notification.relatedDocId) {
          toast({ title: "Error", description: "Notification is missing data for review.", variant: "destructive" });
          return;
      }
      setIsLoadingReviewData(true);
      setIsReviewDialogOpen(true);
      setSelectedNotificationForReview(notification);
      try {
          const requestDocRef = doc(db, 'updateRequests', notification.relatedDocId);
          const requestDocSnap = await getDoc(requestDocRef);
          if (requestDocSnap.exists()) {
              setSelectedUpdateRequest({ id: requestDocSnap.id, ...requestDocSnap.data() } as UpdateRequest);
          } else {
              throw new Error("Update request document not found.");
          }
      } catch (error) {
          console.error("Error fetching update request:", error);
          toast({ title: "Error", description: "Could not load the update request details.", variant: "destructive" });
          setIsReviewDialogOpen(false);
      } finally {
          setIsLoadingReviewData(false);
      }
  }, [toast]);

  const handleNotificationClick = useCallback(async (notification: Notification, e: React.MouseEvent) => {
    if (userRole === 'admin' && (notification.type === 'update_request' || notification.type === 'delete_request') && !notification.title.startsWith('[')) {
        e.preventDefault();
        await openReviewDialog(notification);
        return;
    }
    
    if (!notification.isRead) {
      try {
        const notifRef = doc(db, "notifications", notification.id);
        await updateDoc(notifRef, { isRead: true });
      } catch (error) {
        console.error("Error marking notification as read: ", error);
        toast({ title: "Update Error", description: "Could not mark notification as read.", variant: "destructive" });
      }
    }
  }, [userRole, toast, openReviewDialog]);

  const handleReviewRequest = async (action: 'approve' | 'decline') => {
    if (!selectedUpdateRequest || !selectedNotificationForReview || !currentUser) {
        toast({ title: "Error", description: "Cannot process request due to missing data.", variant: "destructive" });
        return;
    }
    setResolvingId(selectedUpdateRequest.id);
    
    const { requestType, id: requestId, originalLedgerEntryId, originalData, updatedData, requestedByUid } = selectedUpdateRequest;
    const requestRef = doc(db, 'updateRequests', requestId);
    const managerNotifRef = doc(collection(db, 'notifications'));
    const adminNotifRef = doc(db, 'notifications', selectedNotificationForReview.id);

    try {
        if (requestType === 'update') {
            const batch = writeBatch(db);
            if (action === 'approve') {
                await runTransaction(db, async (transaction) => {
                    const ledgerRef = doc(db, 'ledgerEntries', originalLedgerEntryId);
                    const originalLedgerSnap = await transaction.get(ledgerRef);
                    if (!originalLedgerSnap.exists()) throw new Error("Original ledger entry not found.");
                    
                    const oldPaymentDocRef = originalData.associatedPaymentRecordId ? doc(db, "payments", originalData.associatedPaymentRecordId) : null;
                    if(oldPaymentDocRef) await transaction.get(oldPaymentDocRef);

                    const productIdsInvolved = new Set<string>();
                    (updatedData.items || []).forEach((item: LedgerItem) => productIdsInvolved.add(item.productId));
                    (originalData.items || []).forEach((item: LedgerItem) => productIdsInvolved.add(item.productId));
                    
                    const productSnaps = new Map<string, DocumentSnapshot<DocumentData>>();
                    for (const productId of productIdsInvolved) {
                        const productRef = doc(db, "products", productId);
                        productSnaps.set(productId, await transaction.get(productRef));
                    }
                    
                    productSnaps.forEach((productSnap, productId) => {
                      if (!productSnap.exists()) throw new Error(`Product ID ${productId} not found.`);
                      let currentDbStock = productSnap.data()!.stock as number;
                      const originalItem = originalData.items.find(i => i.productId === productId);
                      const newItem = updatedData.items.find((i: LedgerItem) => i.productId === productId);
                      if (originalItem) currentDbStock += originalData.type === 'sale' ? originalItem.quantity : -originalItem.quantity;
                      if (newItem) currentDbStock += updatedData.type === 'sale' ? -newItem.quantity : newItem.quantity;
                      if (currentDbStock < 0) throw new Error(`Insufficient stock for ${productSnap.data()!.name}.`);
                      transaction.update(productSnap.ref, { stock: currentDbStock, updatedAt: serverTimestamp() });
                    });

                    const newEntryRequiresPayment = updatedData.paymentStatus === 'paid' || updatedData.paymentStatus === 'partial';
                    let finalLedgerData = { ...updatedData, updatedAt: serverTimestamp(), updatedByUid: currentUser.uid, updatedByName: currentUser.displayName || currentUser.email };
                    
                    if(newEntryRequiresPayment){
                        const paymentData = {
                            type: updatedData.type === 'sale' ? 'customer' : 'supplier', relatedEntityName: updatedData.entityName, relatedEntityId: updatedData.entityId,
                            relatedInvoiceId: updatedData.relatedInvoiceId ?? null, date: format(parseISO(updatedData.date), "MMM dd, yyyy"), isoDate: updatedData.date,
                            amountPaid: updatedData.amountPaidNow, originalInvoiceAmount: updatedData.grandTotal, remainingBalanceOnInvoice: updatedData.remainingAmount,
                            method: updatedData.paymentMethod, transactionId: null, status: updatedData.paymentStatus === 'paid' ? 'Completed' : 'Partial',
                            notes: `From Ledger: ${updatedData.notes || ''}`.trim(), ledgerEntryId: ledgerRef.id, updatedAt: serverTimestamp()
                        };
                        if(oldPaymentDocRef) {
                            transaction.set(oldPaymentDocRef, {...paymentData, createdAt: originalData.createdAt}, {merge: true});
                        } else {
                            const newPaymentDocRef = doc(collection(db, "payments"));
                            transaction.set(newPaymentDocRef, {...paymentData, createdAt: serverTimestamp()});
                            finalLedgerData.associatedPaymentRecordId = newPaymentDocRef.id;
                        }
                    } else if(oldPaymentDocRef) {
                        transaction.delete(oldPaymentDocRef);
                        finalLedgerData.associatedPaymentRecordId = null;
                    }
                    transaction.set(ledgerRef, finalLedgerData, { merge: true });
                });
                batch.update(requestRef, { status: 'approved', reviewedByUid: currentUser.uid, reviewedAt: serverTimestamp() });
                batch.set(managerNotifRef, { recipientUid: requestedByUid, title: `Update Approved`, message: `Your update for "${originalData.entityName}" was approved.`, link: `/ledger`, isRead: false, createdAt: serverTimestamp(), type: 'update_approved' });
                batch.update(adminNotifRef, { isRead: true, title: `[Approved] ${selectedNotificationForReview.title}` });
            } else {
                batch.update(requestRef, { status: 'declined', reviewedByUid: currentUser.uid, reviewedAt: serverTimestamp() });
                batch.set(managerNotifRef, { recipientUid: requestedByUid, title: `Update Declined`, message: `Your update for "${originalData.entityName}" was declined.`, link: `/ledger`, isRead: false, createdAt: serverTimestamp(), type: 'update_declined' });
                batch.update(adminNotifRef, { isRead: true, title: `[Declined] ${selectedNotificationForReview.title}` });
            }
            await batch.commit();
            toast({ title: `Update ${action === 'approve' ? 'Approved' : 'Declined'}`, description: `Action completed successfully.` });
        } else if (requestType === 'delete') {
            if (action === 'approve') {
                await runTransaction(db, async (transaction) => {
                    const ledgerDocRef = doc(db, "ledgerEntries", originalLedgerEntryId);
                    const productRefs = originalData.items.map(item => doc(db, "products", item.productId));
                    const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));
                    
                    productSnaps.forEach((productSnap, index) => {
                        if (productSnap.exists()) {
                            const item = originalData.items[index];
                            const stockChange = originalData.type === 'sale' ? item.quantity : -item.quantity;
                            transaction.update(productSnap.ref, { stock: productSnap.data().stock + stockChange });
                        }
                    });

                    if (originalData.associatedPaymentRecordId) {
                        transaction.delete(doc(db, "payments", originalData.associatedPaymentRecordId));
                    }
                    transaction.delete(ledgerDocRef);
                });
                const batch = writeBatch(db);
                batch.update(requestRef, { status: 'approved', reviewedByUid: currentUser.uid, reviewedAt: serverTimestamp() });
                batch.set(managerNotifRef, { recipientUid: requestedByUid, title: `Deletion Approved`, message: `Request to delete entry for "${originalData.entityName}" was approved.`, link: `/ledger`, isRead: false, createdAt: serverTimestamp(), type: 'delete_approved' });
                batch.update(adminNotifRef, { isRead: true, title: `[Deleted] ${selectedNotificationForReview.title}` });
                await batch.commit();
                toast({ title: "Deletion Approved", description: "Ledger entry has been deleted." });
            } else {
                const batch = writeBatch(db);
                batch.update(requestRef, { status: 'declined', reviewedByUid: currentUser.uid, reviewedAt: serverTimestamp() });
                batch.set(managerNotifRef, { recipientUid: requestedByUid, title: `Deletion Declined`, message: `Request to delete entry for "${originalData.entityName}" was declined.`, link: `/ledger`, isRead: false, createdAt: serverTimestamp(), type: 'delete_declined' });
                batch.update(adminNotifRef, { isRead: true, title: `[Declined] ${selectedNotificationForReview.title}` });
                await batch.commit();
                toast({ title: "Deletion Declined", description: "Deletion request declined." });
            }
        }
    } catch (error: any) {
        console.error("Error handling review request:", error);
        toast({ title: "Action Failed", description: `Could not process the request: ${error.message}`, variant: "destructive" });
    } finally {
        setResolvingId(null);
        setIsReviewDialogOpen(false);
        setSelectedUpdateRequest(null);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const renderReviewDialogContent = () => {
    if (isLoadingReviewData) return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!selectedUpdateRequest) return <div className="text-center p-8 text-muted-foreground">Could not load request details.</div>;

    const { requestType, originalData, updatedData, requestedByName, requestedAt } = selectedUpdateRequest;

    if (requestType === 'delete') {
        return (
            <div className="space-y-4 p-2 text-sm">
                <p className="text-lg font-semibold text-center text-destructive">Confirm Deletion Request</p>
                <Card className="p-4 bg-muted/50 border-destructive/50">
                    <p><strong>Date:</strong> {originalData.date ? format(parseISO(originalData.date), "MMM dd, yyyy") : 'N/A'}</p>
                    <p><strong>Entity:</strong> {originalData.entityName}</p>
                    <p><strong>Total:</strong> {formatCurrency(originalData.grandTotal)}</p>
                    <p className="text-xs text-muted-foreground mt-2">This action is permanent and will revert any associated stock changes.</p>
                </Card>
                <p className="text-xs text-muted-foreground text-center">Requested by {requestedByName} on {requestedAt ? format(requestedAt.toDate(), "MMM dd, yyyy 'at' HH:mm") : 'a moment ago'}</p>
            </div>
        );
    }
    
    const simpleChanges = getChangedFields(originalData, updatedData);
    const originalItems = originalData.items || [];
    const newItems = updatedData?.items || [];
    const itemChangeDetected = JSON.stringify(originalItems) !== JSON.stringify(newItems);

    return (
        <div className="space-y-4 text-sm">
            <p className="text-xs text-muted-foreground text-center">Requested by {requestedByName} on {requestedAt ? format(requestedAt.toDate(), "MMM dd, yyyy 'at' HH:mm") : 'a moment ago'}</p>
            {simpleChanges.length === 0 && !itemChangeDetected && <p className="text-center text-muted-foreground p-4">No changes detected in main fields or items.</p>}
            {simpleChanges.map(({ key, oldValue, newValue }) => (
                <div key={key} className="p-3 border rounded-lg bg-background shadow-sm">
                    <p className="font-semibold capitalize text-foreground mb-2">{key.replace(/([A-Z])/g, ' $1')}</p>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <div className="p-2 rounded-md bg-red-500/10 text-red-700 dark:text-red-300">
                           <span className="font-medium text-xs block text-red-900 dark:text-red-200">FROM</span>
                           <span className="line-through">{String(oldValue ?? 'Not set')}</span>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground mx-auto hidden md:block" />
                        <div className="p-2 rounded-md bg-green-500/10 text-green-700 dark:text-green-300">
                           <span className="font-medium text-xs block text-green-900 dark:text-green-200">TO</span>
                           {String(newValue ?? 'Not set')}
                        </div>
                    </div>
                </div>
            ))}
            {itemChangeDetected && (
               <div className="p-3 border rounded-lg bg-background shadow-sm">
                    <p className="font-semibold text-foreground mb-2">Items Changed</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="font-medium text-xs text-red-900 dark:text-red-200 mb-1">Original Items</p>
                            <div className="p-2 rounded-md bg-red-500/10 text-red-700 dark:text-red-300 text-xs space-y-1">
                                {originalItems.length > 0 ? originalItems.map((item, i) => <p key={`old-${i}`}>{item.quantity} x {item.productName} @ {formatCurrency(item.unitPrice)}</p>) : <p>No items.</p>}
                            </div>
                        </div>
                        <div>
                             <p className="font-medium text-xs text-green-900 dark:text-green-200 mb-1">Updated Items</p>
                            <div className="p-2 rounded-md bg-green-500/10 text-green-700 dark:text-green-300 text-xs space-y-1">
                                {newItems.length > 0 ? newItems.map((item, i) => <p key={`new-${i}`}>{item.quantity} x {item.productName} @ {formatCurrency(item.unitPrice)}</p>) : <p>No items.</p>}
                            </div>
                        </div>
                    </div>
               </div>
            )}
        </div>
    );
  };

  if (isLoading) {
    return <PageHeader title="Notifications" description="Loading your notifications..." icon={Bell} />;
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Your latest alerts and updates are shown here."
        icon={Bell}
        actions={ <Button onClick={handleMarkAllAsRead} disabled={unreadCount === 0}> <CheckCheck className="mr-2 h-4 w-4"/> Mark All as Read ({unreadCount}) </Button> }
      />
      <Card className="shadow-lg rounded-xl">
        <CardHeader>
          <CardTitle className="font-headline text-foreground">Your Feed</CardTitle>
          <CardDescription>Click on a notification to view its details and mark it as read.</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FileWarning className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground mb-4" />
              <p className="text-lg sm:text-xl font-semibold text-muted-foreground">No Notifications Yet</p>
              <p className="text-xs sm:text-sm text-muted-foreground">You're all caught up! New notifications will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <Link href={notification.link} key={notification.id} onClick={(e) => handleNotificationClick(notification, e)} className="block">
                  <div className={`p-4 border rounded-lg transition-colors flex items-start gap-4 ${!notification.isRead ? "bg-primary/10 border-primary/20 hover:bg-primary/20" : "bg-muted/50 hover:bg-muted"}`}>
                    <div className="flex-shrink-0 mt-1">{!notification.isRead && (<div className="h-2.5 w-2.5 rounded-full bg-primary" aria-label="Unread"></div>)}</div>
                    <div className="flex-grow">
                      <p className="font-semibold text-foreground">{notification.title}</p>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })}</p>
                      {userRole === 'admin' && notification.type === 'issue_report' && !notification.title.startsWith('[Resolved]') && (
                        <div className="mt-2">
                          <Button size="sm" variant="outline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMarkAsResolved(notification); }} disabled={resolvingId === notification.id}>
                            {resolvingId === notification.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />} Mark as Resolved
                          </Button>
                        </div>
                      )}
                      {userRole === 'admin' && (notification.type === 'update_request' || notification.type === 'delete_request') && !notification.title.startsWith('[') && (
                        <div className="mt-2">
                          <Button size="sm" variant="default" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openReviewDialog(notification); }} disabled={resolvingId === notification.relatedDocId}>
                            <Eye className="mr-2 h-4 w-4" /> Review Request
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
          <DialogContent className="max-w-3xl">
              <DialogHeader>
                  <DialogTitle>Review Request</DialogTitle>
                  <DialogDescription>From: {selectedUpdateRequest?.requestedByName} | Type: {selectedUpdateRequest?.requestType?.toUpperCase()}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] p-1">{renderReviewDialogContent()}</ScrollArea>
              {selectedUpdateRequest?.status === 'pending' && (
                <DialogFooter>
                    <Button variant="outline" onClick={() => handleReviewRequest('decline')} disabled={resolvingId === selectedUpdateRequest?.id}>
                        <ThumbsDown className="mr-2 h-4 w-4" />Decline
                    </Button>
                    <Button onClick={() => handleReviewRequest('approve')} disabled={resolvingId === selectedUpdateRequest?.id}>
                         {resolvingId === selectedUpdateRequest?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ThumbsUp className="mr-2 h-4 w-4" />}
                        Approve
                    </Button>
                </DialogFooter>
              )}
          </DialogContent>
      </Dialog>
    </>
  );
}
