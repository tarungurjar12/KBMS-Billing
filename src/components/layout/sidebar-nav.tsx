
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "../ui/button";
import { auth } from '@/lib/firebase/firebaseConfig';
import { signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth'; // Renamed to avoid conflict

/**
 * @fileOverview Sidebar navigation component.
 * Displays navigation links based on user role.
 * Handles user logout using Firebase.
 * Relies on a 'userRole' cookie to determine which links to show.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: ('admin' | 'store_manager')[];
}

const allNavItems: NavItem[] = [
  { href: "/", label: "Admin Dashboard", icon: LayoutDashboard, roles: ['admin'] },
  { href: "/store-dashboard", label: "Store Dashboard", icon: LayoutDashboard, roles: ['store_manager'] },
  { href: "/managers", label: "Manage Managers", icon: UserCog, roles: ['admin'] },
  { href: "/customers", label: "Manage Customers", icon: Users, roles: ['admin', 'store_manager'] },
  { href: "/sellers", label: "Manage Sellers", icon: Truck, roles: ['admin'] },
  { href: "/products", label: "Products DB", icon: Package, roles: ['admin'] },
  { href: "/pricing-rules", label: "Pricing Rules", icon: SlidersHorizontal, roles: ['admin'] },
  { href: "/stock", label: "Inventory Levels", icon: Boxes, roles: ['admin'] },
  { href: "/billing", label: "Billing / Invoicing", icon: FileText, roles: ['admin'] },
  { href: "/payments", label: "Payment Records", icon: CreditCard, roles: ['admin'] },
  // Store Manager Specific
  { href: "/create-bill", label: "Create Bill", icon: ClipboardPlus, roles: ['store_manager'] },
  { href: "/view-products-stock", label: "View Products & Stock", icon: PackageSearch, roles: ['store_manager'] },
  { href: "/my-profile", label: "My Profile", icon: UserCircle, roles: ['store_manager', 'admin'] }, // Admin might also want a profile page
];

/**
 * Retrieves a cookie value by name.
 * @param name - The name of the cookie.
 * @returns The cookie value or undefined if not found.
 */
const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

/**
 * Deletes a cookie by name.
 * @param name - The name of the cookie to delete.
 */
const deleteCookie = (name: string) => {
  if (typeof document !== 'undefined') {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }
};

/**
 * Sets a cookie in the browser.
 * @param name - The name of the cookie.
 * @param value - The value of the cookie.
 * @param days - The number of days until the cookie expires.
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
 * Renders the sidebar navigation links and logout functionality.
 */
export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { open } = useSidebar(); // Context from SidebarProvider
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); 
    const roleFromCookie = getCookie('userRole');
    setUserRole(roleFromCookie);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) { // If Firebase user is logged out
        deleteCookie('userRole');
        setUserRole(undefined);
        if (pathname !== '/login') {
            router.push('/login');
        }
      } else {
        // User is signed in, ensure role cookie is still set or re-set it
        const currentRole = getCookie('userRole');
        if (!currentRole && user.email) {
            let newRole = '';
            if (user.email.toLowerCase().includes('admin@')) newRole = 'admin';
            else if (user.email.toLowerCase().includes('manager@')) newRole = 'store_manager';
            
            if (newRole) {
               setCookie('userRole', newRole, 1);
               setUserRole(newRole);
            }
        } else if (currentRole) {
            setUserRole(currentRole); // Sync state with cookie if already exists
        }
      }
    });

    return () => unsubscribe();
  }, [router, pathname]);

  /**
   * Handles user logout.
   * Signs out from Firebase, clears the userRole cookie, and redirects to login.
   */
  const handleLogout = async () => {
    try {
      await firebaseSignOut(auth);
      deleteCookie('userRole');
      setUserRole(undefined);
      router.push('/login');
    } catch (error) {
      console.error("Error signing out: ", error);
      // Future: Show a toast message for logout error
    }
  };

  if (!mounted) {
    // Avoid rendering mismatch during SSR/hydration for cookie-dependent UI
    return null; 
  }

  const navItemsForRole = allNavItems.filter(item => userRole && item.roles.includes(userRole as 'admin' | 'store_manager'));

  const getDashboardLink = () => {
    if (userRole === 'admin') return '/';
    if (userRole === 'store_manager') return '/store-dashboard';
    return '/login'; // Fallback
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
      <SidebarMenu className="flex-1 p-4">
        {navItemsForRole.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              variant="default"
              className={cn(
                "w-full justify-start",
                pathname === item.href ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90" : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              isActive={pathname === item.href}
              tooltip={item.label}
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
        {open && <p className="text-xs text-muted-foreground">&copy; 2024 KBMS Inc.</p>}
      </SidebarFooter>
    </>
  );
}
