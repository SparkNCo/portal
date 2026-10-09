"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
  ChevronLeft,
  MessageCircle,
  Hammer,
  Bug,
  Video,
  X,
  FolderKanban,
} from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { useUser } from "context/UserContext";
import { useSidebar } from "@/lib/sidebar-context";
import { useSelectedProject } from "@/lib/selected-project-context";
import { developerProjectNames, pickDeveloperProject, routeSlugFor } from "@/lib/developer-routes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { API_JSON_HEADERS } from "@/lib/api-headers";

const clientNavItems = [
  { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "monitor", label: "Monitor", icon: Map },
  { href: "build", label: "Build", icon: Hammer },
  { href: "bugs", label: "Bugs", icon: Bug },
  { href: "demos", label: "Demos", icon: Video },
  { href: "documents", label: "Documents", icon: FileText },
  { href: "chat", label: "Chat", icon: MessageCircle },
  { href: "settings", label: "Settings", icon: Settings },
];

// Resolve to /{slug}/{item} for the initiative selected in "Working on"
// (see lib/developer-routes.ts).
const developerNavItems = [
  { href: "developer", label: "Developer", icon: Code2 },
  { href: "build", label: "Build", icon: Hammer },
  { href: "bugs", label: "Bugs", icon: Bug },
  { href: "demos", label: "Demos", icon: Video },
  { href: "chat", label: "Chat", icon: MessageCircle },
  { href: "documents", label: "Documents", icon: FileText },
];

// Absolute, unlike the other roles' items: admins reach these from inside a
// customer's /{slug} pages too, where a relative href would resolve under
// the slug.
const adminNavItems = [{ href: "/admin/users", label: "Users", icon: Shield }];

// Customer pages an admin sees for the initiative picked in the dropdown
// (Chat included — it's /{slug}/chat for every role).
const adminCustomerNavItems = clientNavItems;

// The admin's last opened initiative, preselected on /admin pages.
export const ADMIN_LAST_INITIATIVE_KEY = "admin-last-initiative";

type InitiativeOption = { value: string; label: string };

// Same list (and cache key) as the customers query elsewhere in the admin UI.
type CustomerSummary = { clientName: string | null; linear_slug: string | null };

// The initiative picker shared by developers ("Working on", their own
// assignments) and admins (every customer).
function InitiativeSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: InitiativeOption[];
  readonly placeholder?: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <div className="px-4 py-3 border-b border-sidebar-border">
      <label className="mb-1.5 block px-0.5 smalltext font-medium text-sidebar-foreground/50">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full gap-2 rounded-lg border-0 bg-sidebar-accent/60 px-3 smalltext font-medium text-sidebar-foreground shadow-none ring-0 hover:bg-sidebar-accent focus:outline-none focus:ring-2 focus:ring-primary/40 [&>span]:truncate">
          <FolderKanban className="h-3.5 w-3.5 shrink-0 text-primary" />
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="rounded-lg">
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              // Hide the default checkmark indicator for the selected
              // option — the trigger above already shows it, so repeating
              // it in every row here is just noise.
              className="smalltext pr-2 [&>span:first-child]:hidden"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  disabled = false,
  onClick,
}: {
  readonly href: string;
  readonly label: string;
  readonly icon: typeof Shield;
  readonly isActive: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}) {
  // Kept in place (not hidden) so the menu doesn't change shape — e.g. an
  // admin's customer pages before an initiative is picked.
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        title="Select an initiative first"
        className="flex items-center gap-3 rounded-md px-3 py-2 smalltext font-medium text-muted-foreground/50"
      >
        <Icon className="h-4 w-4" />
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 smalltext font-medium transition-colors",
        isActive
          ? "bg-sidebar-accent text-primary font-semibold"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

const stakeholderNavItems = [
  { href: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "monitor", label: "Monitor", icon: Map },
  { href: "build", label: "Build", icon: Hammer },
  { href: "bugs", label: "Bugs", icon: Bug },
  { href: "demos", label: "Demos", icon: Video },
  { href: "documents", label: "Documents", icon: FileText },
  { href: "chat", label: "Chat", icon: MessageCircle },
  // Previously missing entirely — a stakeholder had no way to reach
  // /settings at all, which is where the Stakeholders tab (add/view other
  // stakeholders on this initiative) lives.
  { href: "settings", label: "Settings", icon: Settings },
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
  const { slug: rawUrlSlug, customer: selectedCustomerParam, panel: selectedPanelParam } =
    useParams<{ slug: string; customer?: string; panel?: string }>();
  // Not reliably decoded by useParams() — normalize before comparing or
  // re-encoding into nav links below. Names with spaces/apostrophes (e.g.
  // "What You're Funding") arrive as "what%20you're%20funding": compared
  // raw, the Initiative dropdown never matched them, and re-encoded they
  // stacked encoding on encoding.
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : rawUrlSlug;
  const selectedCustomer = selectedCustomerParam
    ? safeDecodeURIComponent(selectedCustomerParam)
    : selectedCustomerParam;
  const selectedPanel = selectedPanelParam ?? "dashboard";
  // Developers viewing an assigned customer via the older nested
  // `/{devSlug}/dashboards/[customer]/[panel]` flow (dormant — its nav
  // entry is commented out below, but the route still exists).
  const isViewingCustomer =
    profile?.role === "developer" && !!selectedCustomer;
  const dashboardsBasePath = `/${rawUrlSlug}`;
  // Admins browse a customer's own pages directly (e.g. /lualink/...) — the
  // exact same route tree the customer itself uses. Their own pages live
  // under the slug-less /admin, so any `[slug]` segment here means they're
  // viewing a customer.
  const isAdmin = profile?.role === "admin";
  const isAdminViewingCustomerSlug = isAdmin && !!urlSlug;

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
  // An unrecognised or missing role gets no navigation at all (it used to
  // fall back to the developer menu).
  const portalType = profile?.role ?? "";
  const navItems = roleNavMap[portalType] ?? [];

  // Developers can be assigned to several customers at once — "Working on"
  // picks which one. On /{slug} pages the URL decides it; elsewhere (the old
  // /dev/* redirects) the last pick is used (lib/selected-project-context.tsx),
  // then the first assignment.
  const developerProjects = developerProjectNames(profile);
  const { selectedProject, setSelectedProject } = useSelectedProject();
  const { isOpen, close } = useSidebar();
  const selectedDeveloperProject = pickDeveloperProject(profile, urlSlug, selectedProject) ?? "";

  // Switching project on a /{slug} page keeps the developer on the same
  // page for the new initiative.
  const handleDeveloperProjectChange = (clientName: string) => {
    setSelectedProject(clientName);
    if (urlSlug) {
      const panel = pathname.split("/")[2] ?? "developer";
      router.push(`/${routeSlugFor(clientName)}/${panel}`);
    }
  };
  // Landing on a /{slug} page directly (link, bookmark) selects that project
  // in the dropdown too, so the two never disagree.
  useEffect(() => {
    if (portalType !== "developer" || !urlSlug) return;
    const match = developerProjects.find((p) => p.toLowerCase() === urlSlug.toLowerCase());
    if (match && match !== selectedProject) setSelectedProject(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalType, urlSlug, developerProjects.join("|")]);

  // Admins pick from every customer. A customer's route slug is its
  // clientName lowercased (customers without one have no pages to open).
  const { data: customers = [] } = useQuery<CustomerSummary[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`, {
        headers: API_JSON_HEADERS,
      });
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
    enabled: isAdmin,
  });
  const adminInitiativeOptions: InitiativeOption[] = customers
    .filter((c) => c.clientName)
    .map((c) => ({ value: c.clientName!.toLowerCase(), label: c.clientName! }))
    .sort((a, b) => a.label.localeCompare(b.label));
  // Picked from an /admin page: only enables the customer items below, the
  // admin opens one of them when ready. On a customer page the URL decides.
  // Defaults to the last initiative opened in this browser, else the first.
  const [adminPickedInitiative, setAdminPickedInitiative] = useState("");
  useEffect(() => {
    try {
      const last = localStorage.getItem(ADMIN_LAST_INITIATIVE_KEY);
      if (last) setAdminPickedInitiative(last);
    } catch {
      // Storage unavailable — fall back to the first initiative.
    }
  }, []);
  const rememberAdminInitiative = (routeSlug: string) => {
    setAdminPickedInitiative(routeSlug);
    try {
      localStorage.setItem(ADMIN_LAST_INITIATIVE_KEY, routeSlug);
    } catch {
      // Not remembered across visits, still selected for now.
    }
  };
  useEffect(() => {
    if (isAdmin && urlSlug) rememberAdminInitiative(urlSlug.toLowerCase());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, urlSlug]);
  const adminSelectedInitiative = urlSlug
    ? adminInitiativeOptions.find((o) => o.value === urlSlug.toLowerCase())?.value ?? ""
    : adminInitiativeOptions.find((o) => o.value === adminPickedInitiative)?.value ??
      adminInitiativeOptions[0]?.value ??
      "";
  // What the customer items link to — the URL's own slug as-is, so they work
  // before the customers list has loaded.
  const adminNavSlug = urlSlug ?? adminSelectedInitiative;

  // Switching initiative on a customer page keeps the admin on the same
  // page (e.g. /lualink/build → /beassured/build); from an /admin page it
  // just selects it, without navigating.
  const handleAdminInitiativeChange = (routeSlug: string) => {
    if (!urlSlug) {
      rememberAdminInitiative(routeSlug);
      return;
    }
    const currentPanel = pathname.split("/")[2];
    const panel = adminCustomerNavItems.some((item) => item.href === currentPanel) ? currentPanel : "dashboard";
    router.push(`/${encodeURIComponent(routeSlug)}/${panel}`);
    close();
  };

  /* -------------------------
     Logout
  --------------------------*/
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!profile) return null;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-dvh w-full sm:w-60 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200",
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <Building2 className="h-5 w-5 text-primary" />
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
      {portalType === "developer" && developerProjects.length > 1 && (
        <InitiativeSelect
          label="Working on"
          value={selectedDeveloperProject}
          options={developerProjects.map((clientName) => ({ value: clientName, label: clientName }))}
          onChange={handleDeveloperProjectChange}
        />
      )}
      {isAdmin && (
        <InitiativeSelect
          label="Initiative"
          value={adminSelectedInitiative}
          options={adminInitiativeOptions}
          placeholder="Select an initiative"
          onChange={handleAdminInitiativeChange}
        />
      )}
      <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 px-3 py-2">
        {isViewingCustomer ? (
          <>
            <Link
              href={`${dashboardsBasePath}/dashboards`}
              onClick={close}
              className="flex items-center gap-2 rounded-md px-3 py-2 smalltext text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors mb-1"
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
                  "flex items-center gap-3 rounded-md px-3 py-2 smalltext font-medium transition-colors",
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
        ) : isAdmin ? (
          <>
            {/* Always listed so the menu keeps the same items; disabled
                until an initiative is selected. */}
            {adminCustomerNavItems.map((item) => (
              <NavLink
                key={item.href}
                href={adminNavSlug ? `/${encodeURIComponent(adminNavSlug)}/${item.href}` : "#"}
                label={item.label}
                icon={item.icon}
                isActive={
                  isAdminViewingCustomerSlug &&
                  (pathname.endsWith(`/${item.href}`) || pathname.includes(`/${item.href}/`))
                }
                disabled={!adminNavSlug}
                onClick={close}
              />
            ))}
            <p className="px-3 pt-4 pb-1 smalltext font-medium text-sidebar-foreground/50">
              Admin
            </p>
            {adminNavItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={pathname.startsWith(item.href)}
                onClick={close}
              />
            ))}
          </>
        ) : (
          navItems.map((item) => {
            // Developers' relative items point at their selected initiative
            // (or /dev/{item}, which explains there's none yet).
            let href = item.href;
            if (portalType === "developer" && !href.startsWith("/")) {
              href = selectedDeveloperProject
                ? `/${routeSlugFor(selectedDeveloperProject)}/${href}`
                : `/dev/${href}`;
            }
            const isActive = href.startsWith("/")
              ? pathname === href || pathname.startsWith(`${href}/`)
              : pathname.endsWith(`/${href}`) || pathname.includes(`/${href}/`);
            const hrefWithParams = params ? `${href}?${params}` : href;
            return (
              <Link
                key={item.href}
                href={hrefWithParams}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 smalltext font-medium transition-colors",
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
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <span className="text-xs font-medium text-primary">
              {profile.email?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="smalltext font-medium text-sidebar-foreground truncate">
              {profile.email}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 smalltext text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
