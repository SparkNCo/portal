"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "context/UserContext";
import { ChatSpinner } from "./ChatSpinner";
import { initCometChatUser } from "./initCometChatUser";
import { getExistingIssueGroup, getOrCreateIssueGroup } from "./getOrCreateIssueGroup";
import { IssueGroupChat } from "./IssueGroupChat";

export function IssueCometChat({
  issueId,
  issueTitle,
  linearPostedAt,
  slug,
}: {
  readonly issueId: string;
  readonly issueTitle: string;
  readonly linearPostedAt?: number;
  // Which customer this issue belongs to — lets a brand-new chat group get
  // tagged with the right customer even when a developer/admin (not the
  // customer) sends the first message.
  readonly slug?: string;
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
      // Don't create the group (and add all members) just for opening the tab —
      // only look up whether one already exists from a prior message.
      const grp = await getExistingIssueGroup(issueId);
      setGroup(grp);
      setReady(true);
    } catch (err) {
      console.error("Issue chat init error:", err);
      setError("Failed to load chat");
    }
  };

  if (!ready && !error) return <ChatSpinner size="sm" label="Loading chat…" />;
  if (error) return <p className="text-xs text-destructive text-center py-4">{error}</p>;
  if (!user) return null;

  return (
    <IssueGroupChat
      user={user}
      group={group}
      onCreateGroup={() => getOrCreateIssueGroup(issueId, issueTitle, profile, slug)}
      onGroupCreated={setGroup}
    />
  );
}
