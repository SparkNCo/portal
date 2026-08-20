"use client";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Header } from "@/components/headerDashboard";
import ChatLayout from "@/components/chat/CometChat/ChatLayout";
import { LoadingDataPanel } from "@/components/loader";
import { safeDecodeURIComponent } from "@/lib/utils";

function ChatContent() {
  const searchParams = useSearchParams();
  const { slug: rawUrlSlug } = useParams<{ slug: string }>();
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : rawUrlSlug;
  const initialTitle = searchParams.get("newChat") ?? undefined;

  return (
    <div className="flex flex-col h-screen">
      <Header title="Chat" subtitle="Messages and AI Assistant" subtitleClassName="smalltext" />
      <div className="flex flex-1 overflow-hidden">
        <ChatLayout initialTitle={initialTitle} fallbackProjectSlug={urlSlug} />
      </div>
    </div>
  );
}

export default function CometChatPage() {
  return (
    <Suspense fallback={<LoadingDataPanel />}>
      <ChatContent />
    </Suspense>
  );
}
