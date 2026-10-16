"use client";

import { useCallback, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { toast } from "sonner";
import { withoutActions } from "./chatUtils";

// How many messages a chat asks CometChat for at a time.
export const MESSAGES_PAGE_SIZE = 50;

const idOf = (m: any): string => String(m?.getId?.() ?? m?.id ?? "");

// "Load earlier messages" for a CometChat chat. A chat opens with its latest
// MESSAGES_PAGE_SIZE messages; the same request object hands back the page
// before each time it's asked again, so the chat registers it with `started`
// and `loadOlder` asks it for more, putting them on top of the list.
//
// `listRef` is the scrolling element: the view stays on the message the user
// was looking at instead of jumping. `keepPositionRef` tells the chat's
// "scroll to the newest message" effect to sit that update out.
export function useOlderMessages(
  listRef: RefObject<HTMLDivElement | null>,
  setMessages: Dispatch<SetStateAction<any[]>>,
) {
  const requestRef = useRef<any>(null);
  const keepPositionRef = useRef(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Call with the request and the first page it returned (as fetched, before
  // any filtering — a full page means there may be more behind it).
  const started = useCallback((request: any, firstPage: any[]) => {
    requestRef.current = request;
    setHasMore(firstPage.length >= MESSAGES_PAGE_SIZE);
  }, []);

  const loadOlder = useCallback(async () => {
    const request = requestRef.current;
    if (!request || loadingOlder) return;
    setLoadingOlder(true);
    const list = listRef.current;
    const heightBefore = list?.scrollHeight ?? 0;
    try {
      const page: any[] = await request.fetchPrevious();
      setHasMore(page.length >= MESSAGES_PAGE_SIZE);
      keepPositionRef.current = true;
      setMessages((prev) => {
        const have = new Set(prev.map(idOf));
        return [...withoutActions(page).filter((m) => !have.has(idOf(m))), ...prev];
      });
      // Once the older ones are in, put the view back where it was.
      requestAnimationFrame(() => {
        if (list) list.scrollTop += list.scrollHeight - heightBefore;
      });
    } catch (err) {
      console.error("Load earlier messages error:", err);
      toast.error("Couldn't load earlier messages. Please try again.");
    } finally {
      setLoadingOlder(false);
    }
  }, [listRef, loadingOlder, setMessages]);

  return { started, hasMore, loadingOlder, loadOlder, keepPositionRef };
}
