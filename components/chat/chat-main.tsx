"use client"

import { useState } from "react"
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input"
import { Sparkles, Send, Video, Phone, Paperclip, MoreVertical } from "lucide-react"
import { CometChat } from "@cometchat/chat-sdk-javascript";

const aiMessages = [
  {
    id: 1,
    role: "assistant",
    content:
      "Hello! I'm your AI assistant. I can help you with questions about your Linear data, project status, and more. What would you like to know?",
    time: "10:30 AM",
  },
  {
    id: 2,
    role: "user",
    content: "What's the status of the authentication epic?",
    time: "10:31 AM",
  },
  {
    id: 3,
    role: "assistant",
    content:
      "The Authentication & User Management epic is currently **100% complete**. Here's a breakdown:\n\n• 12 issues completed\n• 0 issues remaining\n• Completed ahead of schedule by 2 days\n\nWould you like me to show you the details of any specific tasks?",
    time: "10:31 AM",
  },
]

export function ChatMain() {
  const [message, setMessage] = useState("")

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20">
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">AI Assistant</p>
            <p className="text-xs text-muted-foreground">Ask questions about your Linear data</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Video className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {aiMessages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                msg.role === "user" ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p
                className={`text-xs mt-1 ${msg.role === "user" ? "text-accent-foreground/70" : "text-muted-foreground"}`}
              >
                {msg.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Message input */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-muted-foreground shrink-0">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            placeholder="Ask about your project..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 bg-secondary border-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && message.trim()) {
                setMessage("")
              }
            }}
          />
          <Button size="icon" className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          AI responses are based on your Linear data. Video/audio calls powered by CometChat.
        </p>
      </div>
    </div>
  )
}
