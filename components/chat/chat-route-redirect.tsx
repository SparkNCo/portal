"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "context/UserContext";
import { useSelectedProject } from "@/lib/selected-project-context";
import { pickDeveloperProject, routeSlugFor } from "@/lib/developer-routes";
import { resolveChatRouteSlug } from "@/lib/chat-links";
import { LoadingDataPanel } from "@/components/loader";

// /admin/chats and /dev/chat moved to /{slug}/chat. Old links, bookmarks and
// notifications land here: a ?chatId= link goes to that chat's own
// customer; otherwise a developer goes to their selected initiative's chat.
// The query string is kept, so the chat still opens.
function Redirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, loading } = useUser();
  const { selectedProject } = useSelectedProject();
  const [noTarget, setNoTarget] = useState(false);
  const chatId = searchParams.get("chatId");

  useEffect(() => {
    if (loading || !profile) return;
    let cancelled = false;
    (async () => {
      let slug = chatId ? await resolveChatRouteSlug(chatId, profile) : null;
      if (!slug && profile.role === "developer") {
        const project = pickDeveloperProject(profile, selectedProject);
        slug = project ? routeSlugFor(project) : null;
      }
      if (cancelled) return;
      if (!slug) {
        setNoTarget(true);
        return;
      }
      const query = searchParams.toString();
      router.replace(`/${slug}/chat${query ? `?${query}` : ""}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, profile, chatId, selectedProject, searchParams, router]);

  if (!noTarget) return <LoadingDataPanel />;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/40 p-10 text-center">
        <p className="smalltext font-medium text-foreground">Chat moved into each initiative</p>
        <p className="smalltext text-muted-foreground">
          {profile?.role === "developer"
            ? "Once you're assigned to a customer, their chat will show up here."
            : "Pick an initiative from the sidebar to open its chat."}
        </p>
      </div>
    </div>
  );
}

export function ChatRouteRedirect() {
  return (
    <Suspense fallback={<LoadingDataPanel />}>
      <Redirect />
    </Suspense>
  );
}
