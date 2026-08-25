import { useState } from "react";
import type { Group } from "@cometchat/chat-sdk-javascript";
import { Plus, MessageSquare, Bot, X, ChevronDown, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DirectChatEntry } from "./ChatLayout";

// Radix Select reserves the empty string for "no value" internally, so "no
// customer selected" (show every chat) needs its own sentinel instead.
const ALL_CUSTOMERS_VALUE = "__all__";

type CustomerOption = { id: string; userName: string };

type Props = Readonly<{
  groups: Group[];
  directChats: DirectChatEntry[];
  selectedGroup: Group | null;
  selectedDirect: DirectChatEntry | null;
  onSelectGroup: (group: Group) => void;
  onSelectDirect: (entry: DirectChatEntry) => void;
  onCloseGroup: (group: Group) => void;
  onCloseDirect: (entry: DirectChatEntry) => void;
  isCustomer: boolean;
  canLeaveChats: boolean;
  onCreateChat: () => void;
  // Admin-only: single-select dropdown to filter the group list down to one
  // customer at a time (via each group's `customerId` metadata).
  showCustomerFilter?: boolean;
  customerOptions?: CustomerOption[];
  selectedCustomerId?: string;
  onSelectedCustomerIdChange?: (id: string) => void;
}>;

type GroupItemProps = Readonly<{
  group: Group;
  isSelected: boolean;
  onSelect: () => void;
  onClose: () => void;
  canLeave: boolean;
}>;

type GroupSectionProps = Readonly<{
  slug: string;
  bucket: Group[];
  selectedGroup: Group | null;
  onSelectGroup: (group: Group) => void;
  onCloseGroup: (group: Group) => void;
  canLeaveChats: boolean;
}>;

function GroupAvatar({ name }: Readonly<{ name: string }>) {
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

function GroupItem({ group, isSelected, onSelect, onClose, canLeave }: GroupItemProps) {
  return (
    <div
      className="group/item flex items-center gap-3 px-3 py-2.5 border-b bg-black"
    >
      <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={onSelect}>
        <GroupAvatar name={group.getName()} />
        <div className="min-w-0">
          <div className={`text-sm md:smalltext font-medium truncate ${isSelected ? "text-primary" : ""}`}>
            {group.getName()}
          </div>
        </div>
      </button>
      {canLeave && (
        <button
          onClick={onClose}
          className="opacity-0 group-hover/item:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0"
          title="Leave chat"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function GroupSection({ slug, bucket, selectedGroup, onSelectGroup, onCloseGroup, canLeaveChats }: GroupSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs md:smalltext font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30 border-b hover:bg-secondary/50 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {slug || "Other"}
      </button>
      {!collapsed && bucket.map((group) => (
        <GroupItem
          key={group.getGuid()}
          group={group}
          isSelected={selectedGroup?.getGuid() === group.getGuid()}
          onSelect={() => onSelectGroup(group)}
          onClose={() => onCloseGroup(group)}
          canLeave={canLeaveChats}
        />
      ))}
    </div>
  );
}

function groupBySlug(groups: Group[]): Map<string, Group[]> {
  const map = new Map<string, Group[]>();
  for (const g of groups) {
    const slug: string = (g.getMetadata() as any)?.projectSlug ?? "";
    const bucket = map.get(slug) ?? [];
    bucket.push(g);
    map.set(slug, bucket);
  }
  return map;
}

export default function ChatSideBar({
  groups,
  directChats,
  selectedGroup,
  selectedDirect,
  onSelectGroup,
  onSelectDirect,
  onCloseGroup,
  onCloseDirect,
  isCustomer,
  canLeaveChats,
  onCreateChat,
  showCustomerFilter,
  customerOptions = [],
  selectedCustomerId,
  onSelectedCustomerIdChange,
}: Props) {
  const hasNoChats = groups.length === 0 && directChats.length === 0;
  const groupedBySlug = groupBySlug(groups);
  const showGrouped = groupedBySlug.size > 1;

  return (
    <div className="w-full h-full border-r flex flex-col bg-background">
      {/* Only rendered when there's actually a button inside — otherwise this
          left an empty padded/bordered strip above the list for every
          non-customer role. */}
      {isCustomer && (
        <div className="flex items-center justify-end px-4 py-3 border-b">
          <button
            onClick={onCreateChat}
            className="flex items-center gap-1 text-xs md:smalltext bg-accent text-accent-foreground px-2.5 py-1.5 rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
        </div>
      )}

      {showCustomerFilter && (
        <div className="px-3 py-2 border-b">
          <Select
            value={selectedCustomerId?.trim() ? selectedCustomerId : ALL_CUSTOMERS_VALUE}
            onValueChange={(value) =>
              onSelectedCustomerIdChange?.(value === ALL_CUSTOMERS_VALUE ? "" : value)
            }
          >
            <SelectTrigger className="h-8 text-xs md:smalltext">
              <SelectValue placeholder="All customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CUSTOMERS_VALUE}>
                All customers
              </SelectItem>
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
              {showCustomerFilter && selectedCustomerId
                ? "No chats found for that customer."
                : isCustomer
                  ? "No chats yet. Create one to get started."
                  : "No chats yet."}
            </p>
          </div>
        ) : (
          <>
            {showGrouped
              ? Array.from(groupedBySlug.entries()).map(([slug, bucket]) => (
                  <GroupSection
                    key={slug}
                    slug={slug}
                    bucket={bucket}
                    selectedGroup={selectedGroup}
                    onSelectGroup={onSelectGroup}
                    onCloseGroup={onCloseGroup}
                    canLeaveChats={canLeaveChats}
                  />
                ))
              : groups.map((group) => (
                  <GroupItem
                    key={group.getGuid()}
                    group={group}
                    isSelected={selectedGroup?.getGuid() === group.getGuid()}
                    onSelect={() => onSelectGroup(group)}
                    onClose={() => onCloseGroup(group)}
                    canLeave={canLeaveChats}
                  />
                ))}

            {directChats.map((entry) => {
              const isSelected = selectedDirect?.uid === entry.uid && selectedDirect?.title === entry.title;
              return (
                <div
                  key={`${entry.uid}-${entry.title}`}
                  className={`group/item flex items-center gap-3 px-3 py-2.5 border-b transition-colors ${
                    isSelected
                      ? "bg-accent/10 border-l-2 border-l-accent"
                      : "hover:bg-secondary/40 border-l-2 border-l-transparent"
                  }`}
                >
                  <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => onSelectDirect(entry)}>
                    <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-accent" />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-sm md:smalltext font-medium truncate ${isSelected ? "text-primary" : ""}`}>
                        {entry.title}
                      </div>
                      <div className="text-xs md:smalltext text-muted-foreground">AI Agent</div>
                    </div>
                  </button>
                  <button
                    onClick={() => onCloseDirect(entry)}
                    className="opacity-0 group-hover/item:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0"
                    title="Close chat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Visible to every role — customers/stakeholders create a chat for
          their one initiative directly; developers/admins pick which
          initiative first, via the dropdown in CreateChatModal. */}
      <div className="p-3 border-t">
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
