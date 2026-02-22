"use client";
import { Header } from "@/components/headerDashboard";
import ChatLayout from "@/components/chat/CometChat/ChatLayout";

export default function ChatPage() {
  return (
    <div className="min-h-screen">
      <Header title="Chat" subtitle="Messages and AI Assistant" />

      <div className="flex h-[calc(100vh-3.5rem)]">
        <ChatLayout />
      </div>
    </div>
  );
}
