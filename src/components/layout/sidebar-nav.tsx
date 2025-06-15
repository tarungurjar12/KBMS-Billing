
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Package,
  SlidersHorizontal,
  Boxes,
  CreditCard,
  Building, // Main branding icon
  UserCog, // For Manage Managers
  Truck, // For Manage Sellers
  LogOut,
  UserCircle, // For My Profile
  ClipboardPlus, // For Create Bill
  PackageSearch, // For View Products & Stock
} from "lucide-react";
import React, { useEffect, useState } from 'react';

import { cn } from "@/lib/utils";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarHeader,
  SidebarFooter,
  useSidebar, // Hook to get sidebar open/close state
} from "@/components/ui/sidebar";
import { Button } from "../ui/button";
import { auth } from '@/lib/firebase/firebaseConfig'; // Firebase auth instance
import { signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth'; // Firebase auth functions

/**
 * @fileOverview Sidebar navigation component for the application.
 * Displays navigation links tailored to the authenticated user's role (Admin or Store Manager).
 * Handles user logout by signing out from Firebase and clearing relevant cookies.
 * Relies on a 'userRole' cookie to determine which navigation items are visible.
 */

// Defines the structure for a navigation item
interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType; // Lucide icon component
  roles: ('admin' | 'store_manager')[]; // Roles that can see this item
}

// Master list of all possible navigation items in the application
const allNavItems: NavItem[] = [
  // Admin specific routes
  { href: "/", label: "Admin Dashboard", icon: LayoutDashboard, roles: ['admin'] },
  { href: "/managers", label: "Manage Managers", icon: UserCog, roles: ['admin'] },
  { href: "/sellers", label: "Manage Sellers", icon: Truck, roles: ['admin'] },
  { href: "/products", label: "Products DB", icon: Package, roles: ['admin'] },
  { href: "/pricing-rules", label: "Pricing Rules", icon: SlidersHorizontal, roles: ['admin'] },
  { href: "/stock", label: "Inventory Levels", icon: Boxes, roles: ['admin'] },
  { href: "/billing", label: "Billing / Invoicing", icon: FileText, roles: ['admin'] },
  { href: "/payments", label: "Payment Records", icon: CreditCard, roles: ['admin'] },
  
  // Store Manager specific routes
  { href: "/store-dashboard", label: "Store Dashboard", icon: LayoutDashboard, roles: ['store_manager'] },
  { href: "/create-bill", label: "Create Bill", icon: ClipboardPlus, roles: ['store_manager'] },
  { href: "/view-products-stock", label: "View Products & Stock", icon: PackageSearch, roles: ['store_manager'] },

  // Shared routes (content/permissions might differ client-side or handled by specific page logic)
  { href: "/customers", label: "Manage Customers", icon: Users, roles: ['admin', 'store_manager'] },
  { href: "/my-profile", label: "My Profile", icon: UserCircle, roles: ['admin', 'store_manager'] },
];

/**
 * Helper function to retrieve a cookie value by its name.
 * @param {string} name - The name of the cookie.
 * @returns {string | undefined} The cookie value or undefined if not found.
 */
const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined; // Client-side only
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

/**
 * Helper function to delete a cookie by its name.
 * Sets the cookie's expiration date to the past.
 * @param {string} name - The name of the cookie to delete.
 */
const deleteCookie = (name: string) => {
  if (typeof document !== 'undefined') { // Client-side only
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }
};

/**
 * Helper function to set a cookie.
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
 * Renders the sidebar with navigation links based on user role and a logout button.
 * Uses Firebase `onAuthStateChanged` to react to auth state changes and ensure role consistency.
 */
export function SidebarNav() {
  const pathname = usePathname(); // Next.js hook for current path
  const router = useRouter(); // Next.js hook for navigation
  const { open } = useSidebar(); // Custom hook to get sidebar open/collapsed state
  const [userRole, setUserRole] = useState<string | undefined>(undefined); // Local state for user role
  const [mounted, setMounted] = useState(false); // Tracks if component has mounted (for client-side only logic)

  /**
   * Effect hook to set 'mounted' state and manage user role and Firebase auth state.
   * - On mount, it attempts to read the 'userRole' cookie.
   * - It subscribes to Firebase's `onAuthStateChanged` to:
   *   - If Firebase user logs out: Clear the 'userRole' cookie, update local role state, and redirect to login.
   *   - If Firebase user logs in (or session persists): Ensure 'userRole' cookie consistency. If the cookie is missing
   *     but a Firebase user with an email exists, it attempts to re-determine and set the role cookie.
   */
  useEffect(() => {
    setMounted(true); // Indicate component has mounted
    const roleFromCookie = getCookie('userRole');
    setUserRole(roleFromCookie);

    // Subscribe to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) { // Firebase user is logged out
        deleteCookie('userRole'); // Clear role cookie
        setUserRole(undefined); // Clear local role state
        if (pathname !== '/login') { // Avoid redirect loop if already on login page
            router.push('/login'); // Redirect to login
        }
      } else {
        // Firebase user is signed in.
        // Ensure local userRole state and cookie are synchronized.
        const currentRoleCookie = getCookie('userRole');
        if (currentRoleCookie) {
            setUserRole(currentRoleCookie); // Sync local state if cookie exists
        } else if (user.email) {
            // If cookie is missing but Firebase user exists, try to re-establish role from email.
            // This can happen if cookie was cleared manually or expired, but Firebase session persists.
            let newRole = '';
            if (user.email.toLowerCase().includes('admin@')) newRole = 'admin';
            else if (user.email.toLowerCase().includes('manager@')) newRole = 'store_manager';
            
            if (newRole) {
               setCookie('userRole', newRole, 1); // Re-set the cookie
               setUserRole(newRole); // Update local state
            } else {
                // Cannot determine role, treat as unauthenticated for safety
                deleteCookie('userRole');
                setUserRole(undefined);
                if (pathname !== '/login') router.push('/login');
            }
        }
      }
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, [router, pathname]); // Dependencies for the effect

  /**
   * Handles user logout.
   * - Signs out from Firebase.
   * - Clears the 'userRole' cookie.
   * - Clears local 'userRole' state.
   * - Redirects to the login page.
   */
  const handleLogout = async () => {
    try {
      await firebaseSignOut(auth); // Sign out from Firebase
      deleteCookie('userRole'); // Clear the role cookie
      setUserRole(undefined); // Clear local role state
      router.push('/login'); // Redirect to login page
    } catch (error) {
      console.error("Error signing out: ", error);
      // Future: Consider showing a toast message to the user for logout errors.
    }
  };

  // Avoid rendering mismatch during SSR/hydration for cookie-dependent UI by returning null until mounted.
  if (!mounted) {
    return null; 
  }

  // Filter navigation items based on the current user's role.
  const navItemsForRole = allNavItems.filter(item => 
    userRole && item.roles.includes(userRole as 'admin' | 'store_manager')
  );

  // Determines the correct dashboard link for the header based on user role.
  const getDashboardLink = () => {
    if (userRole === 'admin') return '/';
    if (userRole === 'store_manager') return '/store-dashboard';
    return '/login'; // Fallback if role is somehow undefined (shouldn't happen if authenticated)
  }

  return (
    <>
      {/* Sidebar Header: Contains brand logo/name and links to the user's dashboard */}
      <SidebarHeader className="p-4">
        <Link href={getDashboardLink()} className="flex items-center gap-2">
          <Building className="h-7 w-7 text-primary" /> {/* Brand icon */}
          {open && <h1 className="text-xl font-semibold text-primary font-headline">KBMS Billing</h1>} {/* Brand name, visible if sidebar is open */}
        </Link>
      </SidebarHeader>
      <SidebarSeparator /> {/* Visual separator */}
      
      {/* Main navigation menu area */}
      <SidebarMenu className="flex-1 p-4">
        {navItemsForRole.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild // Allows using Link component as the button's child
              variant="default"
              className={cn(
                "w-full justify-start", // Base styling
                pathname === item.href 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90" // Active item styling
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" // Inactive item hover styling
              )}
              isActive={pathname === item.href} // Prop for active state styling
              tooltip={item.label} // Tooltip for collapsed sidebar
            >
              <Link href={item.href}>
                <item.icon className="h-5 w-5" /> {/* Nav item icon */}
                <span>{item.label}</span> {/* Nav item label, visible if sidebar is open */}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
      <SidebarSeparator />
      
      {/* Sidebar Footer: Contains logout button and copyright info */}
      <SidebarFooter className="p-4 space-y-2">
        <Button variant="ghost" className="w-full justify-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={handleLogout}>
          <LogOut className="h-5 w-5 mr-2" /> {/* Logout icon */}
          {open && <span>Logout</span>} {/* Logout text, visible if sidebar is open */}
        </Button>
        {open && <p className="text-xs text-muted-foreground">&copy; 2024 KBMS Inc.</p>} {/* Copyright, visible if sidebar is open */}
      </SidebarFooter>
    </>
  );
}
