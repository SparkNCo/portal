"use client";

import { useEffect, useRef, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { Send } from "lucide-react";
import { COMETCHAT_CONSTANTS } from "./constants";
import { useUser } from "context/UserContext";
import { supabase } from "@/lib/supabase-client";
import { MessageAvatar } from "./MessageAvatar";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { ChatSpinner } from "./ChatSpinner";

function IssueGroupChat({
  user,
  group,
  issueId,
  linearPostedAt,
}: {
  readonly user: CometChat.User;
  readonly group: CometChat.Group;
  readonly issueId: string;
  readonly linearPostedAt?: number;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const guid = group.getGuid();

  useEffect(() => {
    fetchMessages();
  }, [guid]);

  useEffect(() => {
    const listenerId = `issue-chat-${guid}`;
    CometChat.addMessageListener(
      listenerId,
      new CometChat.MessageListener({
        onTextMessageReceived: (msg: CometChat.TextMessage) => {
          if (msg.getReceiverId() === guid) {
            setMessages((prev) => [...prev, msg]);
          }
        },
      }),
    );
    return () => CometChat.removeMessageListener(listenerId);
  }, [guid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      if (!group.getHasJoined()) {
        await CometChat.joinGroup(
          guid,
          CometChat.GROUP_TYPE.PUBLIC as unknown as CometChat.GroupType,
          "",
        );
      }
      const req = new CometChat.MessagesRequestBuilder()
        .setGUID(guid)
        .setLimit(50)
        .build();
      const msgs = await req.fetchPrevious();
      setMessages(msgs);

    } catch (err) {
      console.error("Fetch issue messages error:", err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      const textMsg = new CometChat.TextMessage(
        guid,
        message.trim(),
        CometChat.RECEIVER_TYPE.GROUP,
      );
      const sent = await CometChat.sendMessage(textMsg);
      setMessages((prev) => [...prev, sent]);
      setMessage("");
    } catch (err) {
      console.error("Send issue message error:", err);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <ChatSpinner size="sm" />;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4 italic">
            No messages yet. Start the conversation.
          </p>
        )}
        {messages.map((msg, i) => {
          const senderUid =
            msg.getSender?.()?.getUid?.() ?? msg.sender?.uid ?? "";
          const isMe = senderUid === user.getUid();
          const senderName =
            msg.getSender?.()?.getName?.() ?? msg.sender?.name ?? "Unknown";
          const text =
            msg.getText?.() ?? msg.text ?? msg?.aiAssistantMessageData?.text;
          if (!text?.trim()) return null;
          const sentAt: number | undefined = msg.getSentAt?.() ?? msg.sentAt;

          return (
            <div
              key={msg.getId?.() ?? i}
              className={`flex gap-1.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}
            >
              {!isMe && <MessageAvatar name={senderName} className="w-6 h-6 text-[10px]" />}
              <div
                className={`flex flex-col max-w-[70%] ${isMe ? "items-end" : "items-start"}`}
              >
                {!isMe && (
                  <span className="text-[10px] text-muted-foreground mb-0.5 px-1">
                    {senderName}
                  </span>
                )}
                <div
                  className={`px-2.5 py-1.5 rounded-xl text-xs leading-relaxed ${
                    isMe
                      ? "bg-accent text-accent-foreground rounded-tr-sm"
                      : "bg-secondary text-secondary-foreground rounded-tl-sm"
                  }`}
                >
                  {text}
                </div>
                {!!sentAt && (
                  <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
                    {new Date(sentAt * 1000).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-1 flex justify-end">
        <button
          onClick={() => console.log("[IssueCometChat] all messages:", messages)}
          className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
        >
          debug: log messages
        </button>
      </div>

      <div className="px-3 py-2 border-t border-border">
        <div className="flex items-center gap-1.5 bg-secondary/50 border border-border rounded-lg px-2.5 py-1.5">
          <input
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message…"
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey && sendMessage()
            }
          />
          <button
            onClick={sendMessage}
            disabled={!message.trim() || sending}
            className="w-6 h-6 flex items-center justify-center rounded-md bg-accent text-accent-foreground disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

const groupCreationInFlight = new Map<string, Promise<CometChat.Group>>();

async function resolveGroupName(baseTitle: string): Promise<string> {
  const groupsReq = new CometChat.GroupsRequestBuilder().setLimit(100).build();
  let allGroups: CometChat.Group[] = [];
  try {
    allGroups = await groupsReq.fetchNext();
  } catch {}
  const taken = new Set(allGroups.map((g) => g.getName()));
  if (!taken.has(baseTitle)) return baseTitle;
  let n = 2;
  while (taken.has(`${baseTitle} ${n}`)) n++;
  return `${baseTitle} ${n}`;
}

async function getOrCreateIssueGroup(
  issueId: string,
  issueTitle: string,
  profile: any,
): Promise<CometChat.Group> {
  if (groupCreationInFlight.has(issueId)) {
    return groupCreationInFlight.get(issueId)!;
  }
  const promise = _getOrCreateIssueGroup(issueId, issueTitle, profile);
  groupCreationInFlight.set(issueId, promise);
  promise.finally(() => groupCreationInFlight.delete(issueId));
  return promise;
}

async function _getOrCreateIssueGroup(
  issueId: string,
  issueTitle: string,
  profile: any,
): Promise<CometChat.Group> {
  const safeId = issueId.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const deterministicGuid = `issue_${safeId}`;

  try {
    return await CometChat.getGroup(deterministicGuid);
  } catch {}

  const memberUids = new Set<string>();
  if (profile?.id) memberUids.add(profile.id);

  const headers = API_JSON_HEADERS;

  try {
    if (profile?.role === "stakeholder") {
      const stakeholderRes = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?developer=${profile.id}`,
        { headers },
      );
      const stakeholderAssignments: any[] = await stakeholderRes.json();
      const customerIds = stakeholderAssignments
        .map((a) => a.customer_id)
        .filter(Boolean);

      if (customerIds.length > 0) {
        customerIds.forEach((id: string) => memberUids.add(id));
        const devRes = await fetch(
          `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?customer_id=${customerIds[0]}&onlyDev=true`,
          { headers },
        );
        const assignees: any[] = await devRes.json();
        assignees
          .filter((a) => a.user_id)
          .forEach((a) => memberUids.add(a.user_id));
      }
    } else if (profile?.id) {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/assignments?customer_id=${profile.id}`,
        { headers },
      );
      const assignees: any[] = await res.json();
      assignees
        .filter((a) => a.user_id)
        .forEach((a) => memberUids.add(a.user_id));
    }
  } catch {}

  await Promise.all(
    Array.from(memberUids).map(async (uid) => {
      try {
        await CometChat.getUser(uid);
      } catch (e: any) {
        if (e?.code === "ERR_UID_NOT_FOUND") {
          const u = new CometChat.User(uid);
          u.setName(uid);
          await CometChat.createUser(u, COMETCHAT_CONSTANTS.AUTH_KEY);
        }
      }
    }),
  );

  const groupName = await resolveGroupName(issueTitle);
  const group = new CometChat.Group(
    deterministicGuid,
    groupName,
    CometChat.GROUP_TYPE.PUBLIC,
    "",
  );
  const members = Array.from(memberUids).map(
    (uid) =>
      new CometChat.GroupMember(uid, CometChat.GROUP_MEMBER_SCOPE.PARTICIPANT),
  );

  const response = await CometChat.createGroupWithMembers(group, members, []);
  return (response as any).group ?? response;
}

export function IssueCometChat({ issueId, issueTitle, linearPostedAt }: { readonly issueId: string; readonly issueTitle: string; readonly linearPostedAt?: number }) {
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

      await CometChat.init(
        COMETCHAT_CONSTANTS.APP_ID,
        new CometChat.AppSettingsBuilder()
          .setRegion(COMETCHAT_CONSTANTS.REGION)
          .subscribePresenceForAllUsers()
          .build(),
      );

      const { data } = await supabase.auth.getUser();
      const supaUser = data.user;
      if (!supaUser) throw new Error("Not logged in");

      let cometUser = await CometChat.getLoggedinUser();
      if (cometUser && cometUser.getUid() !== supaUser.id) {
        await CometChat.logout();
        cometUser = null;
      }
      if (!cometUser) {
        try {
          cometUser = await CometChat.login(
            supaUser.id,
            COMETCHAT_CONSTANTS.AUTH_KEY,
          );
        } catch (loginErr: any) {
          if (loginErr?.code !== "ERR_UID_NOT_FOUND") throw loginErr;
          const newUser = new CometChat.User(supaUser.id);
          newUser.setName(supaUser.email ?? supaUser.id);
          await CometChat.createUser(newUser, COMETCHAT_CONSTANTS.AUTH_KEY);
          cometUser = await CometChat.login(
            supaUser.id,
            COMETCHAT_CONSTANTS.AUTH_KEY,
          );
        }
      }
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

  if (error) {
    return (
      <p className="text-xs text-destructive text-center py-4">{error}</p>
    );
  }

  if (!user || !group) return null;

  return <IssueGroupChat user={user} group={group} issueId={issueId} linearPostedAt={linearPostedAt} />;
}
