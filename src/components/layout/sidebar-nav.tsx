
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
import { auth } from '@/lib/firebase/firebaseConfig'; // Import Firebase auth
import { signOut, onAuthStateChanged } from 'firebase/auth';

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
  { href: "/my-profile", label: "My Profile", icon: UserCircle, roles: ['store_manager'] },
];

// Basic cookie utility for userRole
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


export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { open } = useSidebar();
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
        // Middleware should handle redirect, but can add router.push('/login') here if needed as a fallback
        if (pathname !== '/login') { // Avoid redirect loop if already on login
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
            setUserRole(currentRole);
        }
      }
    });

    return () => {
        unsubscribe();
    };

  }, [router, pathname]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      deleteCookie('userRole');
      setUserRole(undefined); // Clear local state
      router.push('/login');
      // router.refresh(); // May not be strictly necessary, Firebase state change should trigger UI updates
    } catch (error) {
      console.error("Error signing out: ", error);
      // Optionally show a toast error
    }
  };

  if (!mounted) {
    // To prevent hydration mismatch, often good to return null or a skeleton here
    return null; 
  }

  const navItemsForRole = allNavItems.filter(item => userRole && item.roles.includes(userRole as 'admin' | 'store_manager'));

  return (
    <>
      <SidebarHeader className="p-4">
        <Link href={userRole === 'admin' ? '/' : (userRole === 'store_manager' ? '/store-dashboard' : '/login')} className="flex items-center gap-2">
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
