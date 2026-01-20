import { Header } from "@/components/headerDashboard"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { ChatMain } from "@/components/chat/chat-main"

export default function ChatPage() {
  return (
    <div className="min-h-screen">
      <Header title="Chat" subtitle="Messages and AI Assistant" />

      <div className="flex h-[calc(100vh-3.5rem)]">
        <ChatSidebar />
        <ChatMain />
      </div>
    </div>
  )
}
