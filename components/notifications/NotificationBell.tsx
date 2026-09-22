"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, MessageCircle, Video, HelpCircle, Palette, FileEdit } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUser } from "context/UserContext";
import { useNotifications, type Notification } from "./useNotifications";

// The ticket wants each item to show action, object, user and created
// time as distinct fields, not a single canned sentence — "<user> <action
// phrase> <object>", then the time on its own line below.
const ACTION_PHRASES: Record<string, string> = {
  chat_message: "sent a message",
  decision_requested: "asked a question",
  decision_answered: "answered a decision",
  demo_uploaded: "uploaded a demo",
  design_resource_added: "added a design resource",
  requirement_update_added: "posted a requirement update",
};

const OBJECT_TYPE_LABELS: Record<string, string> = {
  chat: "in a chat",
  issue_decision: "on a decision",
  demo: "on a demo",
  design_resource: "on a design resource",
};

// Prefer the human-readable ticket code ("on SPA-123") when there is one.
// Chat notifications have no ticket code — show the chat's own title
// ("in <title>") instead, falling back to the generic object-type label
// only for chats with no title (e.g. a direct chat) or older events from
// before object_title existed.
function formatObject(event: { object_type: string; issue_code: string | null; object_title: string | null }): string {
  if (event.issue_code) return `on ${event.issue_code}`;
  if (event.object_type === "chat" && event.object_title) return `in ${event.object_title}`;
  return OBJECT_TYPE_LABELS[event.object_type] ?? "";
}

const ACTION_ICONS: Record<string, typeof MessageCircle> = {
  chat_message: MessageCircle,
  decision_requested: HelpCircle,
  decision_answered: HelpCircle,
  demo_uploaded: Video,
  design_resource_added: Palette,
  requirement_update_added: FileEdit,
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
  design_resource: "design",
};

function resolveLink(n: Notification, role: string | undefined, ownSlug: string | undefined): string {
  const { event } = n;
  if (event.object_type === "chat") {
    return `${resolveChatBasePath(role, ownSlug)}?chatId=${event.object_id}`;
  }
  if (!event.issue_id) return event.link;
  const tab = OBJECT_TYPE_TABS[event.object_type];
  const tabParam = tab ? `&tab=${tab}` : "";
  return `${event.link}?issueId=${event.issue_id}${tabParam}`;
}

function NotificationItem({
  notification,
  onOpen,
}: {
  readonly notification: Notification;
  readonly onOpen: (n: Notification) => void;
}) {
  const { event } = notification;
  const actionPhrase = ACTION_PHRASES[event.action] ?? event.action;
  const Icon = ACTION_ICONS[event.action] ?? MessageCircle;

  return (
    <button
      onClick={() => onOpen(notification)}
      className="group w-full text-left px-3 py-2.5 border-b last:border-b-0 transition-colors bg-accent/5"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" aria-hidden="true" />
        <Icon className="h-4 w-4 mt-0.5 text-popover-foreground/70 group-hover:text-primary flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="smalltext text-popover-foreground group-hover:text-primary">
            <span className="font-medium">{event.actor_email ?? "Someone"}</span> {actionPhrase}{" "}
            {formatObject(event)}
          </p>
          <p className="smalltext text-popover-foreground/70 group-hover:text-primary mt-0.5">
            {formatRelativeTime(notification.created_at)}
          </p>
        </div>
      </div>
    </button>
  );
}

export function NotificationBell() {
  const { profile } = useUser();
  const router = useRouter();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleOpen = (n: Notification) => {
    markAsRead(n.id);
    setOpen(false);
    router.push(resolveLink(n, profile?.role, profile?.linear_slug));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="relative rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-primary"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 max-w-[90vw] p-0">
        {!loading && notifications.length > 0 && (
          <div className="flex justify-end px-3 py-1.5 bg-accent/5">
            <button
              onClick={markAllAsRead}
              className="smalltext text-popover-foreground/70 hover:text-primary"
            >
              Clear all
            </button>
          </div>
        )}
        <div className="max-h-96 overflow-y-auto">
          {loading && <div className="px-3 py-6 text-center smalltext text-muted-foreground">Loading…</div>}
          {!loading && notifications.length === 0 && (
            <div className="px-3 py-6 text-center smalltext text-muted-foreground">No unread notifications.</div>
          )}
          {!loading &&
            notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onOpen={handleOpen} />
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
