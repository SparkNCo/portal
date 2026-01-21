"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Code2,
  Map,
  MessageSquare,
  Settings,
  FileText,
  ChevronDown,
  Building2,
} from "lucide-react";
import { useState } from "react";

const clientNavItems = [
  { href: "roadmap", label: "Roadmap", icon: Map },
  { href: "client", label: "Dashboard", icon: LayoutDashboard },
  { href: "chat", label: "Chat", icon: MessageSquare },
  { href: "documents", label: "Documents", icon: FileText },
  { href: "settings", label: "Settings", icon: Settings },
];

const developerNavItems = [
  { href: "roadmap", label: "Roadmap", icon: Map },
  { href: "developer", label: "Dashboard", icon: Code2 },
  { href: "chat", label: "Chat", icon: MessageSquare },
  { href: "documents", label: "Documents", icon: FileText },
  { href: "settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = searchParams.toString();

  const [portalType, setPortalType] = useState<"roadmap" | "developer">(
    pathname.startsWith("/developer") ? "developer" : "roadmap",
  );

  const navItems =
    portalType === "roadmap" ? clientNavItems : developerNavItems;

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Building2 className="h-5 w-5 text-accent" />
        <span className="font-semibold text-sidebar-foreground">
          Agency Portal
        </span>
      </div>

      <div className="p-3">
        <button
          onClick={() =>
            setPortalType(portalType === "roadmap" ? "developer" : "roadmap")
          }
          className="flex w-full items-center justify-between rounded-md bg-sidebar-accent px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/80 transition-colors"
        >
          <span className="capitalize">{portalType} Portal</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          const hrefWithParams = params
            ? `${item.href}?${params}`
            : item.href;

          return (
            <Link
              key={item.href}
              href={hrefWithParams}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
            <span className="text-xs font-medium text-accent">JD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              John Doe
            </p>
            <p className="text-xs text-muted-foreground truncate">
              john@company.com
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
