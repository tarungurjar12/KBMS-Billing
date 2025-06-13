
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
} from "lucide-react";

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
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/billing", label: "Billing & Invoices", icon: FileText },
  { href: "/products", label: "Products", icon: Package },
  { href: "/pricing-rules", label: "Pricing Rules", icon: SlidersHorizontal },
  { href: "/stock", label: "Stock Availability", icon: Boxes },
  { href: "/payments", label: "Payments", icon: CreditCard },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { open } = useSidebar();

  return (
    <>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <Building className="h-7 w-7 text-primary" />
          {open && <h1 className="text-xl font-semibold text-primary font-headline">KBMS Billing</h1>}
        </Link>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarMenu className="flex-1 p-4">
        {navItems.map((item) => (
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
      <SidebarFooter className="p-4">
        {open && <p className="text-xs text-muted-foreground">&copy; 2024 KBMS Inc.</p>}
      </SidebarFooter>
    </>
  );
}
