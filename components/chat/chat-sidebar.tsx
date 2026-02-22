"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sparkles, MessageSquare, Users, Search, Plus, Calendar } from "lucide-react"

const conversations = [
  {
    id: "ai",
    name: "AI Assistant",
    type: "ai",
    lastMessage: "How can I help you today?",
    time: "Just now",
    unread: 0,
  },
  {
    id: "team",
    name: "Project Team",
    type: "group",
    lastMessage: "Sarah: Updated the designs",
    time: "10m",
    unread: 3,
  },
  {
    id: "pm",
    name: "Alex (Project Manager)",
    type: "direct",
    lastMessage: "Let me check on that",
    time: "1h",
    unread: 0,
  },
  {
    id: "dev",
    name: "Dev Support",
    type: "group",
    lastMessage: "Mike: Fixed the API issue",
    time: "2h",
    unread: 0,
  },
]

export function ChatSidebar() {
  const [activeChat, setActiveChat] = useState("ai")
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="w-72 border-r border-border bg-card flex flex-col">
      <div className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-secondary border-0 pl-9 text-sm"
            />
          </div>
          <Button size="icon" variant="ghost" className="shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <Button variant="outline" className="w-full justify-start gap-2 bg-transparent">
          <Calendar className="h-4 w-4 text-accent" />
          Book a Meeting
          <span className="ml-auto text-xs text-muted-foreground">Cal.com</span>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Conversations</p>
          <div className="space-y-1">
            {conversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => setActiveChat(convo.id)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg p-2 text-left transition-colors",
                  activeChat === convo.id ? "bg-secondary" : "hover:bg-secondary/50",
                )}
              >
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full",
                    convo.type === "ai" ? "bg-accent/20" : convo.type === "group" ? "bg-chart-2/20" : "bg-muted",
                  )}
                >
                  {convo.type === "ai" ? (
                    <Sparkles className="h-4 w-4 text-accent" />
                  ) : convo.type === "group" ? (
                    <Users className="h-4 w-4 text-chart-2" />
                  ) : (
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-card-foreground truncate">{convo.name}</p>
                    <span className="text-xs text-muted-foreground">{convo.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{convo.lastMessage}</p>
                </div>
                {convo.unread > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
                    {convo.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
