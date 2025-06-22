
"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, FileWarning, CheckCheck, CheckSquare, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, Timestamp, writeBatch, addDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebaseConfig';
import type { User as FirebaseUser } from "firebase/auth";
import Link from "next/link";
import { formatDistanceToNow } from 'date-fns';
import { Button } from "@/components/ui/button";
import { useAppContext } from '../layout';

/**
 * @fileOverview Notifications center page.
 * Displays a real-time list of notifications for the currently logged-in user.
 * Allows users to mark notifications as read. Admins can resolve issues from notifications.
 */

export interface Notification {
  id: string;
  recipientUid: string;
  title: string;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: Timestamp;
  // New fields for issue resolution workflow
  type?: 'issue_report' | 'issue_resolved' | 'generic';
  relatedDocId?: string; // e.g., the ID of the issueReport document
  originatorUid?: string;
  originatorName?: string;
  productName?: string;
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const { userRole } = useAppContext();

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
    const q = query(
      collection(db, "notifications"),
      where("recipientUid", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribeFirestore = onSnapshot(q, (querySnapshot) => {
      const fetchedNotifications = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Notification));
      setNotifications(fetchedNotifications);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching notifications: ", error);
      toast({
        title: "Database Error",
        description: "Could not load notifications in real-time.",
        variant: "destructive"
      });
      setIsLoading(false);
    });

    return () => unsubscribeFirestore();

  }, [currentUser, toast]);

  const handleNotificationClick = useCallback(async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        const notifRef = doc(db, "notifications", notification.id);
        await updateDoc(notifRef, { isRead: true });
      } catch (error) {
        console.error("Error marking notification as read: ", error);
        toast({ title: "Update Error", description: "Could not mark notification as read.", variant: "destructive" });
      }
    }
    // Navigation will be handled by the Link component
  }, [toast]);

  const handleMarkAllAsRead = async () => {
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
  };

  const handleMarkAsResolved = async (notification: Notification) => {
    if (userRole !== 'admin' || !notification.relatedDocId || !notification.originatorUid) {
        toast({ title: "Permission Denied", description: "Only admins can resolve issues.", variant: "destructive" });
        return;
    }

    setResolvingId(notification.id);
    try {
        const batch = writeBatch(db);

        // 1. Update the original issueReport document
        const issueReportRef = doc(db, "issueReports", notification.relatedDocId);
        batch.update(issueReportRef, { status: 'Resolved' });

        // 2. Update the admin's notification to reflect it's handled
        const adminNotifRef = doc(db, "notifications", notification.id);
        batch.update(adminNotifRef, { 
            isRead: true, 
            title: `[Resolved] ${notification.title}` 
        });

        // 3. Create a new notification for the manager who reported the issue
        const managerNotifRef = doc(collection(db, "notifications"));
        batch.set(managerNotifRef, {
            recipientUid: notification.originatorUid,
            title: `Issue Resolved: ${notification.productName || 'Product Issue'}`,
            message: `The issue you reported for "${notification.productName || 'a product'}" has been marked as resolved by an admin.`,
            link: notification.link, // Link back to the same product page for confirmation
            isRead: false,
            createdAt: serverTimestamp(),
            type: 'issue_resolved',
            relatedDocId: notification.relatedDocId, // keep track of the original issue
        });

        await batch.commit();
        toast({ title: "Issue Resolved", description: "The issue has been marked as resolved and the manager has been notified." });
    } catch (error) {
        console.error("Error resolving issue:", error);
        toast({ title: "Error", description: "Could not resolve the issue. Please try again.", variant: "destructive" });
    } finally {
        setResolvingId(null);
    }
  };


  if (isLoading) {
    return <PageHeader title="Notifications" description="Loading your notifications..." icon={Bell} />;
  }
  
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Your latest alerts and updates are shown here."
        icon={Bell}
        actions={
            <Button onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
                <CheckCheck className="mr-2 h-4 w-4"/>
                Mark All as Read ({unreadCount})
            </Button>
        }
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
                <Link href={notification.link} key={notification.id} onClick={() => handleNotificationClick(notification)} className="block">
                  <div
                    className={`p-4 border rounded-lg transition-colors flex items-start gap-4 ${
                      !notification.isRead
                        ? "bg-primary/10 border-primary/20 hover:bg-primary/20"
                        : "bg-muted/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex-shrink-0 mt-1">
                      {!notification.isRead && (
                        <div className="h-2.5 w-2.5 rounded-full bg-primary" aria-label="Unread"></div>
                      )}
                    </div>
                    <div className="flex-grow">
                      <p className="font-semibold text-foreground">{notification.title}</p>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })}
                      </p>
                       {userRole === 'admin' && notification.type === 'issue_report' && !notification.title.startsWith('[Resolved]') && (
                        <div className="mt-2">
                            <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleMarkAsResolved(notification);
                            }}
                            disabled={resolvingId === notification.id}
                            >
                            {resolvingId === notification.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <CheckSquare className="mr-2 h-4 w-4" />
                            )}
                            Mark as Resolved
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
    </>
  );
}

