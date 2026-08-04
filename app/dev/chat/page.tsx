"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/headerDashboard";
import ChatLayout from "@/components/chat/CometChat/ChatLayout";
import { LoadingDataPanel } from "@/components/loader";

function ChatContent() {
  const searchParams = useSearchParams();
  const initialTitle = searchParams.get("newChat") ?? undefined;

  return (
    <div className="flex flex-col h-screen">
      <Header title="Chat" subtitle="Messages and AI Assistant" />
      <div className="flex flex-1 overflow-hidden">
        <ChatLayout initialTitle={initialTitle} />
      </div>
    </div>
  );
}

export default function DevChatPage() {
  return (
    <Suspense fallback={<LoadingDataPanel />}>
      <ChatContent />
    </Suspense>
  );
}
