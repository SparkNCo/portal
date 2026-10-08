"use client";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Header } from "@/components/headerDashboard";
import ChatProvider from "@/components/chat/ChatProvider";
import { LoadingDataPanel } from "@/components/loader";
import { safeDecodeURIComponent } from "@/lib/utils";

function ChatContent() {
  const searchParams = useSearchParams();
  const { slug: rawUrlSlug } = useParams<{ slug: string }>();
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : rawUrlSlug;
  const initialTitle = searchParams.get("newChat") ?? undefined;

  return (
    // h-dvh, not h-screen: on phones 100vh is taller than what's visible while
    // the browser bars show, which hid the bottom of the page — the "New Chat"
    // button and the message box.
    <div className="flex flex-col h-dvh">
      <Header title="Chat" subtitle="Messages and AI Assistant" subtitleClassName="smalltext" />
      <div className="flex flex-1 overflow-hidden">
        <ChatProvider initialTitle={initialTitle} fallbackProjectSlug={urlSlug} />
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
