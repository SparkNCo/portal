"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn, safeDecodeURIComponent } from "@/lib/utils";
import {
  LayoutDashboard,
  Code2,
  Map,
  Settings,
  FileText,
  Building2,
  LogOut,
  Shield,
  LayoutGrid,
  ChevronLeft,
  MessageCircle,
  Hammer,
  Bug,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { useUser } from "context/UserContext";
import { useSidebar } from "@/lib/sidebar-context";

const clientNavItems = [
  { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "monitor", label: "Monitor", icon: Map },
  { href: "build", label: "Build", icon: Hammer },
  { href: "bugs", label: "Bugs", icon: Bug },
  { href: "documents", label: "Documents", icon: FileText },
  { href: "chat", label: "Chat", icon: MessageCircle },
  { href: "settings", label: "Settings", icon: Settings },
];

const developerNavItems = [
  /* { href: "dashboards", label: "Assignments", icon: LayoutGrid }, */
  { href: "developer", label: "Developer", icon: Code2 },
  { href: "chat", label: "Chat", icon: MessageCircle },
  { href: "documents", label: "Documents", icon: FileText },
];

const adminNavItems = [
  { href: "users", label: "Users", icon: Shield },
  { href: "dashboards", label: "Dashboards", icon: LayoutGrid },
  { href: "chat", label: "Chat", icon: MessageCircle },
];

const stakeholderNavItems = [
  { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "monitor", label: "Monitor", icon: Map },
  { href: "build", label: "Build", icon: Hammer },
  { href: "bugs", label: "Bugs", icon: Bug },
  { href: "documents", label: "Documents", icon: FileText },
  { href: "chat", label: "Chat", icon: MessageCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = searchParams.toString();
  const router = useRouter();
  const { profile } = useUser();
  // `useParams()` returns the *whole* current route's dynamic segments, not
  // just the ones this component's own layout owns — so `customer`/`panel`
  // show up here whenever the active page is the nested
  // `dashboards/[customer]/[panel]` route, alongside the outer `[slug]`.
  const { slug: urlSlug, customer: selectedCustomerParam, panel: selectedPanelParam } =
    useParams<{ slug: string; customer?: string; panel?: string }>();
  // Not reliably decoded by useParams() — normalize before it's re-encoded
  // into nav links below, or repeated navigation stacks encoding on encoding.
  const selectedCustomer = selectedCustomerParam
    ? safeDecodeURIComponent(selectedCustomerParam)
    : selectedCustomerParam;
  const selectedPanel = selectedPanelParam ?? "dashboard";
  // Developers viewing an assigned customer via the older nested
  // `/{devSlug}/dashboards/[customer]/[panel]` flow (dormant — its nav
  // entry is commented out below, but the route still exists).
  const isViewingCustomer =
    profile?.role === "developer" && !!selectedCustomer;
  const dashboardsBasePath = `/${urlSlug}`;
  // Admins browsing a customer's own dashboard directly (e.g. /lualink/...)
  // — the exact same route tree the customer itself uses. Their own pages
  // live under the slug-less /admin, so any `[slug]` segment here means
  // they're viewing a customer.
  const isAdminViewingCustomerSlug = profile?.role === "admin" && !!urlSlug;

  const customerPanelItems = [
    { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "monitor", label: "Monitor", icon: Map },
    { href: "build", label: "Build", icon: Hammer },
    { href: "bugs", label: "Bugs", icon: Bug },
    //{ href: "developer", label: "Developer", icon: Code2 },
    { href: "chat", label: "Chat", icon: MessageCircle },
    { href: "documents", label: "Documents", icon: FileText },
    ...(profile?.role === "admin"
      ? [{ href: "settings", label: "Settings", icon: Settings }]
      : []),
  ];

  const roleNavMap: Record<string, typeof clientNavItems> = {
    customer: clientNavItems,
    admin: adminNavItems,
    developer: developerNavItems,
    stakeholder: stakeholderNavItems,
  };
  const portalType = profile?.role ?? "developer";
  const navItems = roleNavMap[portalType] ?? developerNavItems;

  /* -------------------------
     Logout
  --------------------------*/
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const { isOpen, close } = useSidebar();

  if (!profile) return null;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen w-full sm:w-60 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200",
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Building2 className="h-5 w-5 text-accent" />
        <span className="flex-1 font-semibold text-sidebar-foreground truncate">
          {profile.clientName ? `${profile.clientName}'s Portal` : "Portal"}
        </span>
        <button
          onClick={close}
          className="lg:hidden rounded-md p-1 text-muted-foreground hover:text-sidebar-foreground"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {isViewingCustomer ? (
          <>
            <Link
              href={`${dashboardsBasePath}/dashboards`}
              onClick={close}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors mb-1"
            >
              <ChevronLeft className="h-3 w-3" />
              All customers
            </Link>
            {customerPanelItems.map((item) => (
              <Link
                key={item.href}
                href={`${dashboardsBasePath}/dashboards/${encodeURIComponent(selectedCustomer!)}/${item.href}`}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  selectedPanel === item.href
                    ? "bg-sidebar-accent text-primary font-semibold"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </>
        ) : isAdminViewingCustomerSlug ? (
          <>
            <Link
              href="/admin/dashboards"
              onClick={close}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors mb-1"
            >
              <ChevronLeft className="h-3 w-3" />
              All customers
            </Link>
            {clientNavItems
              .filter((item) => item.href !== "chat")
              .map((item) => {
                const isActive =
                  pathname.endsWith(`/${item.href}`) ||
                  pathname.includes(`/${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={close}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-primary font-semibold"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
          </>
        ) : (
          navItems.map((item) => {
            const isActive =
              pathname.endsWith(`/${item.href}`) ||
              pathname.includes(`/${item.href}/`);
            const hrefWithParams = params
              ? `${item.href}?${params}`
              : item.href;
            return (
              <Link
                key={item.href}
                href={hrefWithParams}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-primary font-semibold"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })
        )}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center">
            <span className="text-xs font-medium text-accent">
              {profile.email?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {profile.email}
            </p>
            <p className="text-xs text-muted-foreground capitalize">
              {profile.role}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
