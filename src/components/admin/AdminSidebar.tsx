"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Truck,
  Settings,
  FolderTree,
  MessageSquare,
  Mail,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const t = useTranslations("admin.nav");
  const navigation = [
    { name: t("dashboard"), href: "/admin", icon: LayoutDashboard },
    { name: t("products"), href: "/admin/products", icon: Package },
    { name: t("categories"), href: "/admin/categories", icon: FolderTree },
    { name: t("orders"), href: "/admin/orders", icon: ShoppingCart },
    { name: t("reviews"), href: "/admin/reviews", icon: MessageSquare },
    { name: t("newsletter"), href: "/admin/newsletter", icon: Mail },
    { name: t("customers"), href: "/admin/customers", icon: Users },
    { name: t("suppliers"), href: "/admin/suppliers", icon: Truck },
    { name: t("settings"), href: "/admin/settings", icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname?.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "bg-muted/40 flex h-screen flex-col border-r transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <Link href="/admin" className="flex items-center gap-2">
            <span className="text-lg font-bold">{t("wordmark")}</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(collapsed && "mx-auto")}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.name : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-2">
        <Link
          href="/"
          className={cn(
            "text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            collapsed && "justify-center px-2"
          )}
          title={collapsed ? t("backToStore") : undefined}
        >
          <ChevronLeft className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>{t("backToStore")}</span>}
        </Link>
      </div>
    </aside>
  );
}
