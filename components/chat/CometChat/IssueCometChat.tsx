"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "context/UserContext";
import { ChatSpinner } from "./ChatSpinner";
import { initCometChatUser } from "./initCometChatUser";
import { getOrCreateIssueGroup } from "./getOrCreateIssueGroup";
import { IssueGroupChat } from "./IssueGroupChat";

export function IssueCometChat({
  issueId,
  issueTitle,
  linearPostedAt,
}: {
  readonly issueId: string;
  readonly issueTitle: string;
  readonly linearPostedAt?: number;
}) {
  const { profile, loading: profileLoading } = useUser();
  const [user, setUser] = useState<CometChat.User | null>(null);
  const [group, setGroup] = useState<CometChat.Group | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initCalledRef = useRef(false);

  useEffect(() => {
    if (profileLoading || initCalledRef.current) return;
    initCalledRef.current = true;
    init();
  }, [profileLoading, issueId]);

  const init = async () => {
    try {
      (globalThis as any).window.CometChat =
        require("@cometchat/chat-sdk-javascript").CometChat;
      const cometUser = await initCometChatUser();
      setUser(cometUser);
      const grp = await getOrCreateIssueGroup(issueId, issueTitle, profile);
      setGroup(grp);
      setReady(true);
    } catch (err) {
      console.error("Issue chat init error:", err);
      setError("Failed to load chat");
    }
  };

  if (!ready && !error) return <ChatSpinner size="sm" label="Loading chat…" />;
  if (error) return <p className="text-xs text-destructive text-center py-4">{error}</p>;
  if (!user || !group) return null;

  return <IssueGroupChat user={user} group={group} />;
}
