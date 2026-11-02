"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { MentionOption } from "../mentions";
import { quoteSummary } from "./chatUtils";

const idOf = (m: any): string => String(m?.getId?.() ?? m?.id ?? "");

// Replying to messages in a CometChat group chat (GroupChat and a ticket's
// IssueGroupChat): which message is being answered, looking up the message a
// reply quotes, and jumping to it.
//
// `listRef` goes on the element that holds the messages — a jump only looks
// inside it, since two chats can be on screen (the Chat page behind a ticket).
export function useMessageReplies(messages: any[], members: readonly MentionOption[]) {
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const findMessage = useCallback(
    (id: string | number) => messages.find((m) => idOf(m) === String(id)),
    [messages],
  );

  // The message being answered was deleted meanwhile: nothing to answer.
  const current = replyTo ? findMessage(idOf(replyTo)) : null;
  const replyGone = !!replyTo && !!(current?.getDeletedAt?.() ?? current?.deletedAt);
  useEffect(() => {
    if (replyGone) setReplyTo(null);
  }, [replyGone]);

  // What the composer shows above the input.
  const replyingTo = useMemo(() => {
    if (!replyTo) return null;
    const summary = quoteSummary(replyTo, members);
    return { author: summary.senderName, text: summary.text };
  }, [replyTo, members]);

  const jumpToMessage = useCallback((id: string | number) => {
    const target = listRef.current?.querySelector(`[data-message-id="${CSS.escape(String(id))}"]`);
    if (!target) {
      // Only the latest messages are loaded.
      toast("That message is further back than what's loaded here.");
      return;
    }
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightedId(String(id));
    setTimeout(() => setHighlightedId((now) => (now === String(id) ? null : now)), 1800);
  }, []);

  return {
    listRef,
    /** Id of the message to quote when sending, if replying. */
    replyToId: replyTo ? idOf(replyTo) : undefined,
    replyingTo,
    startReply: setReplyTo,
    cancelReply: useCallback(() => setReplyTo(null), []),
    findMessage,
    jumpToMessage,
    highlightedId,
  };
}
