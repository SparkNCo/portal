"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Bell,
  MessageCircle,
  MessageSquare,
  Video,
  HelpCircle,
  Palette,
  FileEdit,
  FileText,
  FileCheck2,
  FileX,
  Search,
  X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { safeDecodeURIComponent } from "@/lib/utils";
import { resolveChatRouteSlug } from "@/lib/chat-links";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { fetchAllNotifications, fetchChatProjectSlugs, useNotifications, type Notification } from "./useNotifications";

// The ticket wants each item to show action, object, user and created
// time as distinct fields, not a single canned sentence — "<user> <action
// phrase> <object>", then the time on its own line below.
const ACTION_PHRASES: Record<string, string> = {
  chat_message: "sent a message",
  decision_requested: "asked a question",
  decision_answered: "answered a decision",
  demo_uploaded: "uploaded a demo",
  demo_comment_added: "left feedback on a demo",
  design_resource_added: "added a design resource",
  requirement_update_added: "posted a requirement update",
  document_request_created: "requested a document",
  document_request_claimed: "is working on the document request",
  document_request_released: "unassigned the document request",
  document_request_completed: "delivered the document request",
};

const OBJECT_TYPE_LABELS: Record<string, string> = {
  chat: "in a chat",
  issue_decision: "on a decision",
  demo: "on a demo",
  demo_comment: "on a demo",
  design_resource: "on a design resource",
  document_request: "a document",
};

// Prefer the human-readable ticket code ("on SPA-123") when there is one.
// Otherwise, prefer the object's own title when notifyProject set one (chat
// and document_request both do — see object_title on portal.events),
// falling back to the generic object-type label only when neither is
// available (e.g. a direct chat with no title, or an older event from
// before object_title existed).
function formatObject(event: { object_type: string; issue_code: string | null; object_title: string | null }): string {
  if (event.issue_code) return `on ${event.issue_code}`;
  if (event.object_title) return event.object_type === "chat" ? `in ${event.object_title}` : `"${event.object_title}"`;
  return OBJECT_TYPE_LABELS[event.object_type] ?? "";
}

const ACTION_ICONS: Record<string, typeof MessageCircle> = {
  chat_message: MessageCircle,
  decision_requested: HelpCircle,
  decision_answered: HelpCircle,
  demo_uploaded: Video,
  demo_comment_added: MessageSquare,
  design_resource_added: Palette,
  requirement_update_added: FileEdit,
  document_request_created: FileText,
  document_request_claimed: FileText,
  document_request_released: FileX,
  document_request_completed: FileCheck2,
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

// Admins and developers have no slug of their own, so for them a chat link
// first goes to the old /admin/chats or /dev/chat route, which redirects to
// the chat's own /{slug}/chat (components/chat/chat-route-redirect.tsx).
// handleOpen resolves that slug directly where it can and skips the hop.
// `notifications.link` is a role-agnostic best-effort page (see
// 20260921150000_create_notifications.sql's notify_chat_message trigger and
// supabase/functions/utils/notify.ts) — this resolves it to the actual
// role-prefixed inbox route at click time, since only the frontend reliably
// knows the viewer's role and (for a customer/stakeholder) their own slug.
// For chat, `object_id` is the chat_id, appended as `?chatId=` so
// Realtime/ChatLayout.tsx's deep-link effect opens that exact conversation
// instead of just landing on the inbox.
function resolveChatBasePath(role: string | undefined, ownSlug: string | undefined): string {
  if (role === "admin") return "/admin/chats";
  if (role === "developer") return "/dev/chat";
  if (ownSlug) return `/${ownSlug}/chat`;
  return "/chat";
}

// build/page.tsx and bugs/page.tsx each read `?issueId=`/`&tab=` and, once
// their own issues list has loaded, open that issue's detail modal straight
// on the right tab — the notification wouldn't be worth much if it just
// dropped you on the dashboard to go find the ticket yourself.
const OBJECT_TYPE_TABS: Record<string, string> = {
  issue_decision: "decisions",
  demo: "demo",
  demo_comment: "demo",
  design_resource: "design",
};

// `event.link` is baked in server-side as `/${projectSlug}/build`,
// `/${projectSlug}/bugs`, or `/${projectSlug}/documents` (see
// resolveIssueDashboardLink/resolveDocumentsLink in
// supabase/functions/utils/notify.ts). Every role, developers included, uses
// those /{slug} pages, so the link is used as-is; the sidebar's "Working on"
// dropdown follows the slug when a developer lands there.

function resolveLink(n: Notification, role: string | undefined, ownSlug: string | undefined): string {
  const { event } = n;
  if (event.object_type === "chat") {
    return `${resolveChatBasePath(role, ownSlug)}?chatId=${event.object_id}`;
  }
  if (!event.issue_id) return event.link;
  const base = event.link;
  const tab = OBJECT_TYPE_TABS[event.object_type];
  const tabParam = tab ? `&tab=${tab}` : "";
  return `${base}?issueId=${event.issue_id}${tabParam}`;
}

// The bell's popover is light (bg-popover), the "See all" modal sits on the
// dark page background — `onDark` swaps the text to the light card color so
// it doesn't end up black-on-black there.
function NotificationItem({
  notification,
  onOpen,
  onDark = false,
}: {
  readonly notification: Notification;
  readonly onOpen: (n: Notification) => void;
  readonly onDark?: boolean;
}) {
  const { event } = notification;
  const textColor = onDark ? "text-card" : "text-popover-foreground";
  const mutedTextColor = onDark ? "text-card/70" : "text-popover-foreground/70";
  const actionPhrase = ACTION_PHRASES[event.action] ?? event.action;
  const Icon = ACTION_ICONS[event.action] ?? MessageCircle;

  return (
    <button
      onClick={() => onOpen(notification)}
      className="group w-full text-left px-3 py-2.5 border-b last:border-b-0 transition-colors bg-accent/5"
    >
      <div className="flex items-start gap-2.5">
        <Icon className={`h-4 w-4 mt-0.5 ${mutedTextColor} group-hover:text-primary flex-shrink-0`} />
        <div className="min-w-0 flex-1">
          <p className={`smalltext ${textColor} group-hover:text-primary`}>
            <span className="font-medium">{event.actor_email ?? "Someone"}</span> {actionPhrase} {formatObject(event)}
          </p>
          <p className={`smalltext ${mutedTextColor} group-hover:text-primary mt-0.5`}>
            {formatRelativeTime(notification.created_at)}
          </p>
        </div>
      </div>
    </button>
  );
}

// Everything a user might type to find a notification: who, what, where,
// and the message preview itself.
function searchableText(n: Notification): string {
  const { event } = n;
  const actionPhrase = ACTION_PHRASES[event.action] ?? event.action;
  return [event.actor_email, actionPhrase, formatObject(event), event.issue_code, event.object_title, event.preview]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// Same list (and cache key) as the admin sidebar's Initiative dropdown.
type CustomerSummary = { clientName: string | null; linear_slug: string | null };

const ALL_CUSTOMERS = "__all__";
const NO_CUSTOMER = "__none__";
// First path segments of event links that aren't a customer slug.
const NON_CUSTOMER_SEGMENTS = new Set(["admin", "dev", "chat"]);

// Which customer a notification belongs to, as a lowercased slug — the
// first segment of its link ("/{slug}/build" etc., see
// supabase/functions/utils/notify.ts), or for chats the chat's own
// project_slug. Null for direct chats with no project. Lowercased because
// slugs come in mixed casing (see the linear_slug case-insensitive fixes).
function customerKeyOf(n: Notification, chatSlugs: Record<string, string | null>): string | null {
  const { event } = n;
  if (event.object_type === "chat") return chatSlugs[event.object_id]?.toLowerCase() ?? null;
  const segment = event.link.split("?")[0]?.split("/").find(Boolean);
  if (!segment || NON_CUSTOMER_SEGMENTS.has(segment)) return null;
  return safeDecodeURIComponent(segment).toLowerCase();
}

// Event slugs are sometimes the route slug (clientName lowercased) and
// sometimes linear_slug — match either, show the customer's name.
function customerLabel(key: string, customers: CustomerSummary[]): string {
  const match = customers.find((c) => c.clientName?.toLowerCase() === key || c.linear_slug?.toLowerCase() === key);
  return match?.clientName || match?.linear_slug || key;
}

// The bell only ever holds PAGE_SIZE (3) notifications — this lists every
// unread one, fetched fresh each time it opens, with a client-side filter.
// Admins get notifications from every customer at once, so they also get a
// customer filter, plus a "Seen" tab to find one they already opened.
type NotificationsTab = "unread" | "seen";

function AllNotificationsModal({
  open,
  onOpenChange,
  onOpen,
  isAdmin,
  startTab = "unread",
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onOpen: (n: Notification) => void;
  readonly isAdmin: boolean;
  // Tab the modal opens on; "seen" when an admin has nothing unread.
  readonly startTab?: NotificationsTab;
}) {
  const [all, setAll] = useState<Notification[]>([]);
  const [chatSlugs, setChatSlugs] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState(ALL_CUSTOMERS);
  const [tab, setTab] = useState<NotificationsTab>(startTab);

  // Reset on close, so reopening always starts clean on `startTab`
  // (resetting on open instead would first fetch the stale tab, then refetch).
  useEffect(() => {
    if (open) return;
    setTab(startTab);
    setQuery("");
  }, [open, startTab]);

  const { data: customers = [] } = useQuery<CustomerSummary[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customers`, {
        headers: API_JSON_HEADERS,
      });
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
    enabled: isAdmin && open,
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCustomerFilter(ALL_CUSTOMERS);
    setLoading(true);
    const load = async () => {
      const rows = await fetchAllNotifications(tab === "seen");
      const chatIds = isAdmin ? rows.filter((n) => n.event.object_type === "chat").map((n) => n.event.object_id) : [];
      const slugs = await fetchChatProjectSlugs([...new Set(chatIds)]);
      if (cancelled) return;
      setAll(rows);
      setChatSlugs(slugs);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, isAdmin, tab]);

  // One option per customer that actually has notifications here, by name.
  const customerOptions = useMemo(() => {
    if (!isAdmin) return [];
    const keys = new Set(all.map((n) => customerKeyOf(n, chatSlugs) ?? NO_CUSTOMER));
    return [...keys]
      .map((key) => ({ key, label: key === NO_CUSTOMER ? "No customer" : customerLabel(key, customers) }))
      .sort((a, b) => {
        if (a.key === NO_CUSTOMER) return 1;
        if (b.key === NO_CUSTOMER) return -1;
        return a.label.localeCompare(b.label);
      });
  }, [all, chatSlugs, customers, isAdmin]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((n) => {
      if (customerFilter !== ALL_CUSTOMERS && (customerKeyOf(n, chatSlugs) ?? NO_CUSTOMER) !== customerFilter) {
        return false;
      }
      return !q || searchableText(n).includes(q);
    });
  }, [all, chatSlugs, query, customerFilter]);

  const isFiltering = query.trim() !== "" || customerFilter !== ALL_CUSTOMERS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="flex flex-col gap-0 p-0 h-[80vh] max-w-xl max-sm:h-dvh max-sm:max-w-none"
      >
        <div className="flex-shrink-0 border-b px-4 pt-4 pb-3 pr-12">
          <DialogTitle className="text-lg font-semibold">
            All notifications
            {!loading && (
              <span className="ml-2 smalltext font-normal text-card/70">
                {all.length} {tab === "seen" ? "seen" : "unread"}
              </span>
            )}
          </DialogTitle>
          {isAdmin && (
            <div role="tablist" aria-label="Notification status" className="mt-3 -mb-3 flex gap-4">
              {(["unread", "seen"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`border-b-2 pb-2 smalltext font-medium capitalize transition-colors ${
                    tab === t ? "border-primary text-primary" : "border-transparent text-card/70 hover:text-primary"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col gap-2 border-b px-4 py-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notifications…"
              aria-label="Search notifications"
              className="pl-9 focus-visible:ring-0 focus-visible:border-primary"
            />
          </div>
          {isAdmin && customerOptions.length > 0 && (
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger
                className="h-9 sm:w-48 smalltext focus:ring-0 focus-visible:border-primary"
                aria-label="Filter by customer"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CUSTOMERS}>All customers</SelectItem>
                {customerOptions.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="px-3 py-6 text-center smalltext text-muted-foreground">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="px-3 py-6 text-center smalltext text-muted-foreground">
              {isFiltering
                ? "No notifications match your filters."
                : tab === "seen"
                  ? "No seen notifications."
                  : "No unread notifications."}
            </div>
          )}
          {!loading && filtered.map((n) => <NotificationItem key={n.id} notification={n} onOpen={onOpen} onDark />)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Below Tailwind's `sm` breakpoint a 384px popover anchored to the header
// bell barely fits and its list is capped at max-h-96 — there the panel
// takes over the whole screen instead, with its own close button.
function useIsSmallScreen(): boolean {
  const [isSmall, setIsSmall] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    setIsSmall(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsSmall(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isSmall;
}

export function NotificationBell() {
  const { profile } = useUser();
  const router = useRouter();
  // The URL's own `[slug]` segment (see context/CustomerSlugContext.tsx) —
  // whatever a customer is already correctly viewing right now. Preferred
  // over `profile.linear_slug` (customers.linear_slug joined server-side),
  // which is looked up independently and can disagree with it — e.g. mixed
  // casing or a stale value (see 20260921190000-era linear_slug fixes). A
  // wrong slug here doesn't just 404: it becomes the new `[slug]` segment
  // for the rest of the session, since sidebar links build off whatever's
  // currently in the URL — so this route/build page's fetches start failing
  // too. Falls back to profile.linear_slug only if the bell is somehow
  // rendered outside a `/[slug]/...` route.
  const customerSlug = useCustomerSlug();
  const { notifications, totalUnreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [seeAllOpen, setSeeAllOpen] = useState(false);

  const handleOpen = async (n: Notification) => {
    // Already-read ones come from the modal's "Seen" tab — re-marking them
    // would make the realtime UPDATE handler decrement the unread count again.
    if (!n.read) markAsRead(n.id);
    setOpen(false);
    setSeeAllOpen(false);

    const { event } = n;
    const needsChatSlug =
      event.object_type === "chat" && (profile?.role === "admin" || profile?.role === "developer");
    const chatSlug = needsChatSlug ? await resolveChatRouteSlug(event.object_id, profile).catch(() => null) : null;
    router.push(
      chatSlug
        ? `/${chatSlug}/chat?chatId=${event.object_id}`
        : resolveLink(n, profile?.role, customerSlug ?? profile?.linear_slug),
    );
  };

  const isSmallScreen = useIsSmallScreen();
  const hasNotifications = !loading && notifications.length > 0;
  const isAdmin = profile?.role === "admin";
  // Admins always get "See all" — it's also their way into older, already
  // seen notifications (the modal's Seen tab). Everyone else only needs it
  // when there are more unread than the popup shows.
  const showSeeAll =
    !loading && (isAdmin || (totalUnreadCount > notifications.length && totalUnreadCount > 3));

  const openSeeAll = () => {
    setOpen(false);
    setSeeAllOpen(true);
  };

  const seeAllFooter = showSeeAll && (
    <button
      onClick={openSeeAll}
      className="w-full flex-shrink-0 border-t px-3 py-2 text-center smalltext font-medium text-primary hover:bg-accent/5"
    >
      {totalUnreadCount > 0 ? `See all (${totalUnreadCount})` : "See all"}
    </button>
  );

  const allNotificationsModal = (
    <AllNotificationsModal
      open={seeAllOpen}
      onOpenChange={setSeeAllOpen}
      onOpen={handleOpen}
      isAdmin={isAdmin}
      startTab={isAdmin && totalUnreadCount === 0 ? "seen" : "unread"}
    />
  );

  const trigger = (
    <button
      aria-label={totalUnreadCount > 0 ? `Notifications, ${totalUnreadCount} unread` : "Notifications"}
      className="relative rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-primary"
    >
      <Bell className="h-5 w-5" />
      {totalUnreadCount > 0 && (
        <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
      )}
    </button>
  );

  const clearAllButton = (
    <button onClick={markAllAsRead} className="smalltext text-popover-foreground/70 hover:text-primary">
      Clear all
    </button>
  );

  const list = (
    <>
      {loading && <div className="px-3 py-6 text-center smalltext text-muted-foreground">Loading…</div>}
      {!loading && notifications.length === 0 && (
        <div className="px-3 py-6 text-center smalltext text-muted-foreground">No unread notifications.</div>
      )}
      {!loading && notifications.map((n) => <NotificationItem key={n.id} notification={n} onOpen={handleOpen} />)}
    </>
  );

  if (isSmallScreen) {
    return (
      <>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>{trigger}</DialogTrigger>
          <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className="fixed inset-0 z-50 flex flex-col bg-popover text-popover-foreground outline-none"
            >
              <div className="flex items-center justify-between gap-3 border-b px-4 h-14 flex-shrink-0">
                <div className="flex min-w-0 items-baseline gap-2">
                  <DialogTitle className="text-lg font-semibold">Notifications</DialogTitle>
                  {hasNotifications && (
                    <span className="smalltext text-popover-foreground/70">{totalUnreadCount} new</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {hasNotifications && clearAllButton}
                  <DialogClose
                    aria-label="Close notifications"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-primary"
                  >
                    <X className="h-5 w-5" />
                  </DialogClose>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">{list}</div>
              {seeAllFooter}
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>
        {allNotificationsModal}
      </>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="start" className="w-[28rem] max-w-[90vw] p-0">
          {hasNotifications && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-accent/5">
              <span className="smalltext text-popover-foreground/70">{totalUnreadCount} new</span>
              {clearAllButton}
            </div>
          )}
          <div className="max-h-96 overflow-y-auto">{list}</div>
          {seeAllFooter}
        </PopoverContent>
      </Popover>
      {allNotificationsModal}
    </>
  );
}
