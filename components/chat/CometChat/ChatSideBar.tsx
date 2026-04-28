import type { Group } from "@cometchat/chat-sdk-javascript";
import { Plus, MessageSquare, Bot } from "lucide-react";
import type { DirectChatEntry } from "./ChatLayout";

type Props = Readonly<{
  groups: Group[];
  directChats: DirectChatEntry[];
  selectedGroup: Group | null;
  selectedDirect: DirectChatEntry | null;
  onSelectGroup: (group: Group) => void;
  onSelectDirect: (entry: DirectChatEntry) => void;
  isCustomer: boolean;
  onCreateChat: () => void;
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

export default function ChatSideBar({
  groups,
  directChats,
  selectedGroup,
  selectedDirect,
  onSelectGroup,
  onSelectDirect,
  isCustomer,
  onCreateChat,
}: Props) {
  const hasNoChats = groups.length === 0 && directChats.length === 0;

  return (
    <div className="w-72 border-r flex flex-col flex-shrink-0 bg-background">
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
            {groups.map((group) => {
              const isSelected = selectedGroup?.getGuid() === group.getGuid();
              return (
                <button
                  key={group.getGuid()}
                  onClick={() => onSelectGroup(group)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 border-b text-left cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-accent/10 border-l-2 border-l-accent"
                      : "hover:bg-secondary/40 border-l-2 border-l-transparent"
                  }`}
                >
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
              );
            })}

            {directChats.map((entry) => {
              const isSelected = selectedDirect?.uid === entry.uid && selectedDirect?.title === entry.title;
              return (
                <button
                  key={`${entry.uid}-${entry.title}`}
                  onClick={() => onSelectDirect(entry)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 border-b text-left cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-accent/10 border-l-2 border-l-accent"
                      : "hover:bg-secondary/40 border-l-2 border-l-transparent"
                  }`}
                >
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
