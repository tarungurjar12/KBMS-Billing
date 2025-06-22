
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  SlidersHorizontal,
  Boxes,
  CreditCard,
  Building,
  UserCog,
  Truck,
  LogOut,
  UserCircle,
  ClipboardPlus,
  PackageSearch,
  BookOpen, 
  Bell,
} from "lucide-react";
import React, { useEffect, useState, useCallback } from 'react';

import { cn } from "@/lib/utils";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { Button } from "../ui/button";
import { auth, db } from '@/lib/firebase/firebaseConfig'; 
import { signOut as firebaseSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

/**
 * @fileOverview Sidebar navigation component for the application.
 * Displays navigation links tailored to the authenticated user's role (Admin or Store Manager).
 * Handles user logout by signing out from Firebase and clearing the 'userRole' cookie.
 * Relies on a 'userRole' cookie (set during login) to determine which navigation items are visible.
 * Listens to Firebase auth state changes to ensure role consistency and handle unexpected logouts.
 */

/**
 * Interface for defining navigation items.
 */
interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: ('admin' | 'store_manager')[]; // Roles that can see this item
}

// Defines all possible navigation items in the application
const allNavItems: NavItem[] = [
  // Admin-specific routes
  { href: "/", label: "Admin Dashboard", icon: LayoutDashboard, roles: ['admin'] },
  { href: "/managers", label: "Manage Managers", icon: UserCog, roles: ['admin'] },
  { href: "/sellers", label: "Manage Sellers", icon: Truck, roles: ['admin'] },
  { href: "/products", label: "Product Database", icon: Package, roles: ['admin'] },
  { href: "/pricing-rules", label: "Pricing Rules", icon: SlidersHorizontal, roles: ['admin'] },
  { href: "/stock", label: "Inventory Levels", icon: Boxes, roles: ['admin'] },
  { href: "/payments", label: "Payment Records", icon: CreditCard, roles: ['admin'] },
  
  // Store Manager-specific routes
  { href: "/store-dashboard", label: "Store Dashboard", icon: LayoutDashboard, roles: ['store_manager'] },
  { href: "/view-products-stock", label: "View Products & Stock", icon: PackageSearch, roles: ['store_manager'] },

  // Shared routes
  { href: "/ledger", label: "Daily Ledger", icon: BookOpen, roles: ['admin', 'store_manager'] }, 
  { href: "/billing", label: "Billing / Invoicing", icon: FileText, roles: ['admin', 'store_manager'] },
  { href: "/create-bill", label: "Create Bill/Invoice", icon: ClipboardPlus, roles: ['admin', 'store_manager'] },
  { href: "/customers", label: "Manage Customers", icon: Users, roles: ['admin', 'store_manager'] },
  { href: "/notifications", label: "Notifications", icon: Bell, roles: ['admin', 'store_manager'] },
  { href: "/my-profile", label: "My Profile", icon: UserCircle, roles: ['admin', 'store_manager'] },
];

/**
 * Retrieves a cookie value by its name.
 * @param {string} name - The name of the cookie.
 * @returns {string | undefined} The cookie value, or undefined if not found.
 */
const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined; 
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

/**
 * Deletes a cookie by setting its expiration date to the past.
 * @param {string} name - The name of the cookie to delete.
 */
const deleteCookie = (name: string) => {
  if (typeof document !== 'undefined') {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }
};

/**
 * Sets a cookie with a specified name, value, and expiration days.
 * @param {string} name - The name of the cookie.
 * @param {string} value - The value of the cookie.
 * @param {number} days - Number of days until the cookie expires.
 */
const setCookie = (name: string, value: string, days: number) => {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    if (typeof document !== 'undefined') {
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
    }
};

/**
 * SidebarNav component.
 * Renders the sidebar with navigation links appropriate for the user's role and a logout button.
 * Handles Firebase authentication state changes to maintain UI consistency.
 * @returns {JSX.Element | null} The rendered sidebar navigation, or null if not mounted or no user role.
 */
export function SidebarNav() {
  const pathname = usePathname();
  const { open } = useSidebar(); 
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  /**
   * Updates the userRole state from the 'userRole' cookie.
   * This function is memoized with useCallback to prevent unnecessary re-creations.
   */
  const updateUserRoleFromCookie = useCallback(() => {
    const roleFromCookie = getCookie('userRole');
    if (roleFromCookie !== userRole) { // Only update if role actually changed
        setUserRole(roleFromCookie);
    }
  }, [userRole]); // Dependency on userRole to compare current state with new cookie value

  // Effect for initial mount and auth state changes
  useEffect(() => {
    setMounted(true); 
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        updateUserRoleFromCookie();
      } else {
        console.log("SidebarNav: Firebase user logged out or session expired.");
        setCurrentUser(null);
        setUserRole(undefined);
        setUnreadCount(0);
        // The main layout's listener will handle the redirection.
      }
    });

    // Listen for custom 'userRoleChanged' event from login page
    const handleRoleChanged = () => {
        console.log("SidebarNav: 'userSessionChanged' event received. Updating role from cookie.");
        updateUserRoleFromCookie();
    };
    window.addEventListener('userSessionChanged', handleRoleChanged);

    return () => {
        unsubscribeAuth();
        window.removeEventListener('userSessionChanged', handleRoleChanged);
    };
  }, [updateUserRoleFromCookie]);


  // Effect for real-time notification count
  useEffect(() => {
    if (!currentUser) {
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("recipientUid", "==", currentUser.uid),
      where("isRead", "==", false)
    );

    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    }, (error) => {
      console.error("Error fetching unread notification count:", error);
    });

    return () => unsubscribeFirestore();
  }, [currentUser]);


  /**
   * Handles user logout.
   * Signs out from Firebase, explicitly clears cookies, and forces a hard refresh to the login page.
   */
  const handleLogout = async () => {
    try {
      await firebaseSignOut(auth);
      // Explicitly delete cookies for faster UI feedback before reload
      deleteCookie('userRole');
      deleteCookie('companyId');
      deleteCookie('activeSessionId');
      // Force a hard reload to the login page to clear all client-side state
      window.location.href = '/login';
    } catch (error) {
      console.error("Error during sign out:", error);
      // Fallback to ensure user is redirected
      window.location.href = '/login';
    }
  };

  if (!mounted) return null; 

  const navItemsForRole = allNavItems.filter(item => 
    userRole && item.roles.includes(userRole as 'admin' | 'store_manager')
  );

  const getDashboardLink = (): string => {
    if (userRole === 'admin') return '/';
    if (userRole === 'store_manager') return '/store-dashboard';
    return '/login'; 
  }

  if (!userRole && pathname !== '/login' && pathname !== '/register-admin') {
    return null; 
  }


  return (
    <>
      <SidebarHeader className="p-4">
        <Link href={getDashboardLink()} className="flex items-center gap-2">
          <Building className="h-7 w-7 text-primary" />
          {open && <h1 className="text-xl font-semibold text-primary font-headline">KBMS Billing</h1>}
        </Link>
      </SidebarHeader>
      <SidebarSeparator />
      
      <SidebarMenu className="flex-1 p-4 overflow-y-auto">
        {navItemsForRole.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild 
              variant="default"
              className={cn(
                "w-full justify-start",
                pathname === item.href 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90" 
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" 
              )}
              isActive={pathname === item.href} 
              tooltip={item.label} 
            >
              <Link href={item.href}>
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
                 {item.label === 'Notifications' && unreadCount > 0 && (
                  <SidebarMenuBadge>{unreadCount}</SidebarMenuBadge>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <SidebarSeparator />
      
      <SidebarFooter className="p-4 space-y-2">
        <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={handleLogout}>
          <LogOut className="h-5 w-5 mr-2" />
          {open && <span>Logout</span>}
        </Button>
        {open && <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} KBMS</p>}
      </SidebarFooter>
    </>
  );
}
