
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

// Basic cookie utility
const getCookie = (name: string): string | undefined => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

const deleteCookie = (name: string) => {
  document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
};

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { open } = useSidebar();
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // Ensure component is mounted before trying to access cookies
    const role = getCookie('userRole');
    setUserRole(role);
  }, []);

  const handleLogout = () => {
    deleteCookie('userRole');
    deleteCookie('authStatus');
    router.push('/login');
  };

  if (!mounted) {
    // Optionally return a loading state or null
    return null; 
  }

  const navItemsForRole = allNavItems.filter(item => userRole && item.roles.includes(userRole as 'admin' | 'store_manager'));

  return (
    <>
      <SidebarHeader className="p-4">
        <Link href={userRole === 'admin' ? '/' : '/store-dashboard'} className="flex items-center gap-2">
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
