import { useState } from "react";
import type { Group } from "@cometchat/chat-sdk-javascript";
import { Plus, MessageSquare, Bot, X, ChevronDown, ChevronRight } from "lucide-react";
import type { DirectChatEntry } from "./ChatLayout";

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
  onCreateChat: () => void;
}>;

type GroupItemProps = Readonly<{
  group: Group;
  isSelected: boolean;
  onSelect: () => void;
  onClose: () => void;
}>;

type GroupSectionProps = Readonly<{
  slug: string;
  bucket: Group[];
  selectedGroup: Group | null;
  onSelectGroup: (group: Group) => void;
  onCloseGroup: (group: Group) => void;
}>;

function GroupAvatar({ name }: Readonly<{ name: string }>) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold flex-shrink-0">
      {initials}
    </div>
  );
}

function GroupItem({ group, isSelected, onSelect, onClose }: GroupItemProps) {
  return (
    <div
      className={`group/item flex items-center gap-3 px-3 py-2.5 border-b transition-colors ${
        isSelected
          ? "bg-accent/10 border-l-2 border-l-accent"
          : "hover:bg-secondary/40 border-l-2 border-l-transparent"
      }`}
    >
      <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={onSelect}>
        <GroupAvatar name={group.getName()} />
        <div className="min-w-0">
          <div className={`text-sm font-medium truncate ${isSelected ? "text-accent" : ""}`}>
            {group.getName()}
          </div>
          <div className="text-xs text-muted-foreground">
            {group.getMembersCount()} members
          </div>
        </div>
      </button>
      <button
        onClick={onClose}
        className="opacity-0 group-hover/item:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0"
        title="Leave chat"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function GroupSection({ slug, bucket, selectedGroup, onSelectGroup, onCloseGroup }: GroupSectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/30 border-b hover:bg-secondary/50 transition-colors"
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
  onCreateChat,
}: Props) {
  const hasNoChats = groups.length === 0 && directChats.length === 0;
  const groupedBySlug = groupBySlug(groups);
  const showGrouped = groupedBySlug.size > 1;

  return (
    <div className="w-full h-full border-r flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Chats</span>
        </div>
        {isCustomer && (
          <button
            onClick={onCreateChat}
            className="flex items-center gap-1 text-xs bg-accent text-accent-foreground px-2.5 py-1.5 rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3 h-3" />
            New
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {hasNoChats ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-12 px-4 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {isCustomer ? "No chats yet. Create one to get started." : "No chats yet."}
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
                  />
                ))
              : groups.map((group) => (
                  <GroupItem
                    key={group.getGuid()}
                    group={group}
                    isSelected={selectedGroup?.getGuid() === group.getGuid()}
                    onSelect={() => onSelectGroup(group)}
                    onClose={() => onCloseGroup(group)}
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
                      <div className={`text-sm font-medium truncate ${isSelected ? "text-accent" : ""}`}>
                        {entry.title}
                      </div>
                      <div className="text-xs text-muted-foreground">AI Agent</div>
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

      {/* isCustomer && ( visible only to customers ) */}
      <div className="p-3 border-t">
        <button
          onClick={onCreateChat}
          className="flex items-center justify-center gap-2 w-full text-sm bg-accent text-accent-foreground px-3 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>
    </div>
  );
}
