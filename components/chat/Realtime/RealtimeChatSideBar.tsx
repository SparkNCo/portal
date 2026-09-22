"use client";

import { useMemo, useState } from "react";
import { Plus, MessageSquare, ChevronDown, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Chat } from "./useRealtimeChat";

type CustomerOption = { id: string; userName: string };

type Props = Readonly<{
  chats: Chat[];
  selectedChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
  onCreateChat: () => void;
  showCustomerFilter?: boolean;
  customerOptions?: CustomerOption[];
  selectedCustomerId?: string;
  onSelectedCustomerIdChange?: (id: string) => void;
}>;

function ChatAvatar({ name }: Readonly<{ name: string }>) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-muted text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
      {initials}
    </div>
  );
}

function ChatItem({
  chat,
  isSelected,
  onSelect,
}: Readonly<{ chat: Chat; isSelected: boolean; onSelect: () => void }>) {
  return (
    <div
      className={`group/item flex items-center gap-3 px-3 py-2.5 border-b transition-colors ${
        isSelected
          ? "bg-accent/10 border-l-2 border-l-accent"
          : "hover:bg-secondary/40 border-l-2 border-l-transparent"
      }`}
    >
      <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={onSelect}>
        <ChatAvatar name={chat.title ?? "Chat"} />
        <div className="min-w-0">
          <div className={`text-sm md:smalltext font-medium truncate ${isSelected ? "text-primary" : ""}`}>
            {chat.title ?? "Chat"}
          </div>
        </div>
      </button>
    </div>
  );
}

function ChatSection({
  slug,
  bucket,
  selectedChat,
  onSelectChat,
}: Readonly<{ slug: string; bucket: Chat[]; selectedChat: Chat | null; onSelectChat: (chat: Chat) => void }>) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs md:smalltext font-semibold text-muted-foreground bg-secondary/30 border-b hover:bg-secondary/50 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {slug || "Other"}
      </button>
      {!collapsed && bucket.map((chat) => (
        <ChatItem
          key={chat.id}
          chat={chat}
          isSelected={selectedChat?.id === chat.id}
          onSelect={() => onSelectChat(chat)}
        />
      ))}
    </div>
  );
}

// Same bucketing rationale as CometChat/ChatSideBar.tsx's groupByProject:
// prefer project_slug, fall back to resolving metadata.customerId to a name
// so chats created with no project route in scope (e.g. from /admin/chats)
// still land under the right customer instead of an "Other" catch-all.
function groupByProject(chats: Chat[], customerNameById: Map<string, string>): Map<string, Chat[]> {
  const map = new Map<string, Chat[]>();
  for (const c of chats) {
    const key = c.project_slug || (c.metadata?.customerId && customerNameById.get(c.metadata.customerId)) || "";
    const bucket = map.get(key) ?? [];
    bucket.push(c);
    map.set(key, bucket);
  }
  return map;
}

export default function RealtimeChatSideBar({
  chats,
  selectedChat,
  onSelectChat,
  onCreateChat,
  showCustomerFilter,
  customerOptions = [],
  selectedCustomerId,
  onSelectedCustomerIdChange,
}: Props) {
  const hasNoChats = chats.length === 0;
  const customerNameById = useMemo(
    () => new Map(customerOptions.map((c) => [c.id, c.userName])),
    [customerOptions],
  );
  const groupedBySlug = groupByProject(chats, customerNameById);
  const showGrouped = groupedBySlug.size > 1;

  return (
    <div className="w-full h-full border-r flex flex-col bg-background">
      {showCustomerFilter && (
        <div className="px-3 py-2 border-b">
          <Select value={selectedCustomerId} onValueChange={(value) => onSelectedCustomerIdChange?.(value)}>
            <SelectTrigger className="h-8 text-xs md:smalltext">
              <SelectValue placeholder="Select a customer" />
            </SelectTrigger>
            <SelectContent>
              {customerOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.userName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {hasNoChats ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-12 px-4 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm md:smalltext text-muted-foreground">
              {showCustomerFilter && selectedCustomerId ? "No chats found for that customer." : "No chats yet."}
            </p>
          </div>
        ) : showGrouped ? (
          Array.from(groupedBySlug.entries()).map(([slug, bucket]) => (
            <ChatSection key={slug} slug={slug} bucket={bucket} selectedChat={selectedChat} onSelectChat={onSelectChat} />
          ))
        ) : (
          chats.map((chat) => (
            <ChatItem key={chat.id} chat={chat} isSelected={selectedChat?.id === chat.id} onSelect={() => onSelectChat(chat)} />
          ))
        )}
      </div>

      <div className="h-[72px] flex items-center px-4 border-t">
        <button
          onClick={onCreateChat}
          className="flex items-center justify-center gap-2 w-full text-sm md:smalltext bg-accent text-accent-foreground px-3 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>
    </div>
  );
}
