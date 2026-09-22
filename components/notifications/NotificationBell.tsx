"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, MessageCircle, Video, HelpCircle, Palette, FileEdit } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUser } from "context/UserContext";
import { useNotifications, type Notification } from "./useNotifications";

// Word filled into "There is a new <word>[ for <issue_code>]" — kept to one
// word per the simplified phrasing, no actor/preview details.
const ACTION_WORDS: Record<string, string> = {
  chat_message: "message",
  decision_requested: "question",
  decision_answered: "answer",
  demo_uploaded: "video",
  design_resource_added: "design",
  requirement_update_added: "requirement update",
};

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
  if (n.object_type === "chat") {
    return `${resolveChatBasePath(role, ownSlug)}?chatId=${n.object_id}`;
  }
  if (!n.issue_id) return n.link;
  const tab = OBJECT_TYPE_TABS[n.object_type];
  const tabParam = tab ? `&tab=${tab}` : "";
  return `${n.link}?issueId=${n.issue_id}${tabParam}`;
}

function NotificationItem({
  notification,
  onOpen,
}: {
  readonly notification: Notification;
  readonly onOpen: (n: Notification) => void;
}) {
  const word = ACTION_WORDS[notification.action] ?? notification.action;
  const Icon = ACTION_ICONS[notification.action] ?? MessageCircle;

  return (
    <button
      onClick={() => onOpen(notification)}
      className="group w-full text-left px-3 py-2.5 border-b last:border-b-0 transition-colors bg-accent/5 hover:bg-secondary/40"
    >
      <div className="flex items-center gap-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" aria-hidden="true" />
        <Icon className="h-4 w-4 text-popover-foreground/70 group-hover:text-primary flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="smalltext text-popover-foreground group-hover:text-primary whitespace-nowrap overflow-hidden text-ellipsis">
            There is a new {word}
            {notification.issue_code ? ` for ${notification.issue_code}` : ""}
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
            <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-max min-w-80 max-w-[90vw] p-0">
        {!loading && notifications.length > 0 && (
          <div className="flex justify-end px-3 py-1.5 border-b">
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
