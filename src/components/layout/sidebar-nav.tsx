
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
  BookOpen, // Icon for Ledger
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
import { auth } from '@/lib/firebase/firebaseConfig';
import { signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';

/**
 * @fileOverview Sidebar navigation component for the application.
 * Displays navigation links tailored to the authenticated user's role (Admin or Store Manager).
 * Handles user logout by signing out from Firebase and clearing relevant cookies.
 * Relies on a 'userRole' cookie to determine which navigation items are visible.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: ('admin' | 'store_manager')[];
}

const allNavItems: NavItem[] = [
  { href: "/", label: "Admin Dashboard", icon: LayoutDashboard, roles: ['admin'] },
  { href: "/managers", label: "Manage Managers", icon: UserCog, roles: ['admin'] },
  { href: "/sellers", label: "Manage Sellers", icon: Truck, roles: ['admin'] },
  { href: "/products", label: "Products DB", icon: Package, roles: ['admin'] },
  { href: "/ledger", label: "Daily Ledger", icon: BookOpen, roles: ['admin'] }, // Added Ledger
  { href: "/pricing-rules", label: "Pricing Rules", icon: SlidersHorizontal, roles: ['admin'] },
  { href: "/stock", label: "Inventory Levels", icon: Boxes, roles: ['admin'] },
  { href: "/billing", label: "Billing / Invoicing", icon: FileText, roles: ['admin', 'store_manager'] }, // Admin can see all, manager sees own?
  { href: "/payments", label: "Payment Records", icon: CreditCard, roles: ['admin'] },
  
  { href: "/store-dashboard", label: "Store Dashboard", icon: LayoutDashboard, roles: ['store_manager'] },
  { href: "/create-bill", label: "Create Bill", icon: ClipboardPlus, roles: ['admin', 'store_manager'] }, // Also for Admin
  { href: "/view-products-stock", label: "View Products & Stock", icon: PackageSearch, roles: ['store_manager'] },

  { href: "/customers", label: "Manage Customers", icon: Users, roles: ['admin', 'store_manager'] },
  { href: "/my-profile", label: "My Profile", icon: UserCircle, roles: ['admin', 'store_manager'] },
];

const getCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

const deleteCookie = (name: string) => {
  if (typeof document !== 'undefined') {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }
};

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
 * @returns {JSX.Element | null} The rendered sidebar navigation or null if not mounted.
 */
export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { open } = useSidebar();
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  const updateUserRoleFromCookie = useCallback(() => {
    const roleFromCookie = getCookie('userRole');
    setUserRole(roleFromCookie);
  }, []);

  useEffect(() => {
    setMounted(true);
    updateUserRoleFromCookie(); // Initial check

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        deleteCookie('userRole');
        setUserRole(undefined);
        if (pathname !== '/login') {
            router.push('/login');
        }
      } else {
        const currentRoleCookie = getCookie('userRole');
        if (currentRoleCookie) {
            setUserRole(currentRoleCookie);
        } else if (user.email) {
            let newRole = '';
            if (user.email.toLowerCase().includes('admin@')) newRole = 'admin';
            else if (user.email.toLowerCase().includes('manager@')) newRole = 'store_manager';
            
            if (newRole) {
               setCookie('userRole', newRole, 1);
               setUserRole(newRole);
            } else {
                deleteCookie('userRole');
                setUserRole(undefined);
                if (pathname !== '/login') router.push('/login');
            }
        }
      }
    });
    // Listen for custom event that might be dispatched after login sets the cookie
    window.addEventListener('userRoleChanged', updateUserRoleFromCookie);

    return () => {
        unsubscribe();
        window.removeEventListener('userRoleChanged', updateUserRoleFromCookie);
    };
  }, [router, pathname, updateUserRoleFromCookie]);

  const handleLogout = async () => {
    try {
      await firebaseSignOut(auth);
      // Auth state listener above will handle cookie deletion and redirect.
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (!mounted) return null; 

  const navItemsForRole = allNavItems.filter(item => 
    userRole && item.roles.includes(userRole as 'admin' | 'store_manager')
  );

  const getDashboardLink = () => {
    if (userRole === 'admin') return '/';
    if (userRole === 'store_manager') return '/store-dashboard';
    return '/login'; 
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
        {open && <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} KBMS Inc.</p>}
      </SidebarFooter>
    </>
  );
}
