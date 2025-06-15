
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
  Building,
  UserCog,
  Truck,
  LogOut,
  UserCircle,
  ClipboardPlus,
  PackageSearch,
  BookOpen, // Icon for Ledger page
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
} from "@/components/ui/sidebar";
import { Button } from "../ui/button";
import { auth } from '@/lib/firebase/firebaseConfig'; // Firebase auth instance
import { signOut as firebaseSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'; // Firebase auth functions

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
  { href: "/ledger", label: "Daily Ledger", icon: BookOpen, roles: ['admin', 'store_manager'] }, // Ledger accessible by both
  { href: "/pricing-rules", label: "Pricing Rules", icon: SlidersHorizontal, roles: ['admin'] },
  { href: "/stock", label: "Inventory Levels", icon: Boxes, roles: ['admin'] },
  { href: "/payments", label: "Payment Records", icon: CreditCard, roles: ['admin'] },
  
  // Store Manager-specific routes
  { href: "/store-dashboard", label: "Store Dashboard", icon: LayoutDashboard, roles: ['store_manager'] },
  { href: "/view-products-stock", label: "View Products & Stock", icon: PackageSearch, roles: ['store_manager'] },

  // Shared routes
  { href: "/billing", label: "Billing / Invoicing", icon: FileText, roles: ['admin', 'store_manager'] },
  { href: "/create-bill", label: "Create Bill/Invoice", icon: ClipboardPlus, roles: ['admin', 'store_manager'] },
  { href: "/customers", label: "Manage Customers", icon: Users, roles: ['admin', 'store_manager'] },
  { href: "/my-profile", label: "My Profile", icon: UserCircle, roles: ['admin', 'store_manager'] },
];

/**
 * Retrieves a cookie value by its name.
 * @param {string} name - The name of the cookie.
 * @returns {string | undefined} The cookie value, or undefined if not found.
 */
const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined; // Ensure browser environment
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
  const router = useRouter();
  const { open } = useSidebar(); // Context for sidebar open/close state (visual only)
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  const [mounted, setMounted] = useState(false); // Tracks if component has mounted on client

  /**
   * Updates the userRole state from the 'userRole' cookie.
   */
  const updateUserRoleFromCookie = useCallback(() => {
    const roleFromCookie = getCookie('userRole');
    setUserRole(roleFromCookie);
  }, []);

  // Effect for initial mount and auth state/cookie changes
  useEffect(() => {
    setMounted(true); // Component has mounted
    updateUserRoleFromCookie(); // Initial role check from cookie

    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
      if (!user) { // If Firebase reports no user (e.g., signed out, session expired)
        console.log("SidebarNav: Firebase user logged out or session expired.");
        deleteCookie('userRole'); // Clear role cookie
        setUserRole(undefined); // Clear local role state
        if (pathname !== '/login') { // If not already on login, redirect
            router.push('/login');
        }
      } else { // User is authenticated in Firebase
        const currentRoleCookie = getCookie('userRole');
        if (currentRoleCookie) { // Role cookie exists, ensure local state matches
            if (userRole !== currentRoleCookie) setUserRole(currentRoleCookie);
        } else if (user.email) { // No role cookie, but Firebase user exists (e.g., cookie expired)
            // Attempt to re-determine and set role cookie based on email pattern
            let newRole = '';
            if (user.email.toLowerCase().includes('admin@')) newRole = 'admin';
            else if (user.email.toLowerCase().includes('manager@')) newRole = 'store_manager';
            
            if (newRole) { // If role can be determined
               setCookie('userRole', newRole, 1); // Set cookie (e.g., for 1 day)
               setUserRole(newRole);
            } else { // Cannot determine role from email, treat as invalid session
                console.warn("SidebarNav: Firebase user exists, but role couldn't be determined from email. Forcing logout.");
                deleteCookie('userRole');
                setUserRole(undefined);
                firebaseSignOut(auth).catch(console.error); // Sign out from Firebase
                if (pathname !== '/login') router.push('/login');
            }
        }
      }
    });

    // Listen for custom 'userRoleChanged' event (e.g., dispatched after login)
    // This helps update the sidebar immediately if the cookie changes elsewhere.
    window.addEventListener('userRoleChanged', updateUserRoleFromCookie);

    // Cleanup listeners on component unmount
    return () => {
        unsubscribe();
        window.removeEventListener('userRoleChanged', updateUserRoleFromCookie);
    };
  }, [router, pathname, updateUserRoleFromCookie, userRole]); // userRole added to re-evaluate if it changes externally

  /**
   * Handles user logout.
   * Signs out from Firebase. The onAuthStateChanged listener will then clear cookies and redirect.
   */
  const handleLogout = async () => {
    try {
      await firebaseSignOut(auth);
      // The onAuthStateChanged listener above will handle cookie deletion and redirection to /login.
    } catch (error) {
      console.error("Error signing out from Firebase: ", error);
      // Fallback: Manually clear cookie and redirect if Firebase signout fails for some reason
      deleteCookie('userRole');
      setUserRole(undefined);
      router.push('/login');
    }
  };

  // Don't render anything until component has mounted on the client
  if (!mounted) return null; 

  // Filter navigation items based on the current user's role
  const navItemsForRole = allNavItems.filter(item => 
    userRole && item.roles.includes(userRole as 'admin' | 'store_manager')
  );

  /**
   * Determines the correct dashboard link based on user role.
   * @returns {string} The path to the user's dashboard or login page.
   */
  const getDashboardLink = (): string => {
    if (userRole === 'admin') return '/';
    if (userRole === 'store_manager') return '/store-dashboard';
    return '/login'; // Default to login if role is somehow undefined
  }

  // If no user role is determined (e.g., not logged in), don't render the main sidebar content.
  // This is a fallback; middleware and layout effects should handle redirection.
  if (!userRole && pathname !== '/login') {
    return null; // Or a minimal loading/error state if preferred
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
      
      <SidebarMenu className="flex-1 p-4 overflow-y-auto"> {/* Added overflow-y-auto for long lists */}
        {navItemsForRole.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild // Allows Link component to be the actual button for navigation
              variant="default"
              className={cn(
                "w-full justify-start",
                pathname === item.href 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90" // Active link style
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" // Hover style for inactive links
              )}
              isActive={pathname === item.href} // Prop for internal styling if SidebarMenuButton uses it
              tooltip={item.label} // Tooltip for collapsed sidebar
            >
              <Link href={item.href}>
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
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
        {open && <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} Your Company</p>}
      </SidebarFooter>
    </>
  );
}

