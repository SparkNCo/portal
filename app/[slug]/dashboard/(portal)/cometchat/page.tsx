"use client";
import { Header } from "@/components/headerDashboard";
import ChatLayout from "@/components/chat/CometChat/ChatLayout";

export default function CometChatPage() {
  return (
    <div className="flex flex-col h-screen">
      <Header title="Chat" subtitle="Messages and AI Assistant" />
      <div className="flex flex-1 overflow-hidden">
       {/*  <ChatLayout /> */}
      </div>
    </div>
  );
}
