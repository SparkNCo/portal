"use client";

import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { COMETCHAT_CONSTANTS } from "./constants";
import { supabase } from "@/lib/supabase-client";

import AIChatInput from "./AIChatInput";
import StaffChatInput from "./StaffChatInput";
import { Button } from "@/components/components/ui/button";
import ConversationChat from "./ConversationChat";
import type { Dispatch, SetStateAction } from "react";
type ChatMode = "response" | "ai" | "staff";
type Conversation = any; // temporal
type ChatProps = {
  user: CometChat.User | null;
  setUser: Dispatch<SetStateAction<CometChat.User | null>>;

  mode: ChatMode;
  setMode: Dispatch<SetStateAction<ChatMode>>;

  conversationId: string | null;
  setConversationId: Dispatch<SetStateAction<string | null>>;

  activeUID: string | null;
  setActiveUID: Dispatch<SetStateAction<string | null>>;

  notification: any;
  setNotification: Dispatch<SetStateAction<any>>;

  responseConversation: Conversation | null;
  setResponseConversation: Dispatch<SetStateAction<Conversation | null>>;
};

export default function Chat({
  user,
  setUser,
  mode,
  setMode,
  conversationId,
  setConversationId,
  activeUID,
  setActiveUID,
  notification,
  setNotification,
  responseConversation,
  setResponseConversation,
}: ChatProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const AI_UID = process.env.NEXT_PUBLIC_COMET_AI_UID as string;
  const STAFF_UID = process.env.NEXT_PUBLIC_COMET_ADMIN_UID as string;
  useEffect(() => {
    initCometChat();
  }, []);
  const initCometChat = async () => {
    try {
      await CometChat.init(
        COMETCHAT_CONSTANTS.APP_ID,
        new CometChat.AppSettingsBuilder()
          .setRegion(COMETCHAT_CONSTANTS.REGION)
          .subscribePresenceForAllUsers()
          .build(),
      );
      const loggedUser = await CometChat.getLoggedinUser();

      if (loggedUser) {
        setUser(loggedUser);
        setLoading(false);
        return;
      }
      const { data } = await supabase.auth.getUser();
      const UID = data.user?.id ?? "UID";
      const logged = await CometChat.login(UID, COMETCHAT_CONSTANTS.AUTH_KEY);
      console.log("✅ Login successful", logged);
      setUser(logged);
    } catch (err) {
      console.error("❌ CometChat error:", err);
      setError("Failed to initialize chat");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // Default conversation
  // =========================
  useEffect(() => {
    if (!activeUID) {
      setActiveUID(AI_UID);
    }
  }, [activeUID]);

  // =========================
  // Global Message Listener
  // =========================
  useEffect(() => {
    if (!user) return;

    const listenerID = "global-message-listener";

    CometChat.addMessageListener(
      listenerID,
      new CometChat.MessageListener({
        onTextMessageReceived: (msg: CometChat.TextMessage) => {
          console.log("📩 Incoming:", msg);

          const convId = msg.getConversationId();
          setConversationId(convId);

          if (msg.getSender()?.getName() && mode !== "response") {
            setNotification({
              type: "staff",
              text: msg.getText(),
              from: msg.getSender()?.getName() ?? "",
              uid: msg.getSender()?.getUid() ?? "",
            });
          }
        },
      }),
    );

    return () => {
      CometChat.removeMessageListener(listenerID);
    };
  }, [user, mode]);

  if (loading) {
    return <div className="p-4">Loading chat...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }
  return (
    <div className="relative flex flex-1 flex-col border-4">
      {notification && (
        <div
          className="absolute top-4 right-4 bg-black text-white px-4 py-2 rounded-lg shadow-lg cursor-pointer z-50"
          onClick={() => {
            setResponseConversation(notification);
            setMode("response");
            setNotification(null);
          }}
        >
          <div>
            <div className="text-xs opacity-70 px-8">
              New message from {notification.from}
            </div>
            <button
              className="absolute top-1 right-1 text-xs opacity-70 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setNotification(null);
              }}
            >
              ✕
            </button>
          </div>
          <div className="text-sm font-medium truncate max-w-[220px] px-8">
            {notification.text}
          </div>
        </div>
      )}

      {conversationId && mode === "response" && (
        <ConversationChat user={user} notification={responseConversation} />
      )}
      {mode === "ai" && activeUID && (
        <div className="flex flex-1 items-center justify-center">
          <AIChatInput user={user!} />{" "}
        </div>
      )}
      {mode === "staff" && activeUID && (
        <div className="flex flex-1 items-center justify-center">
          <StaffChatInput />
        </div>
      )}
      <Button
        className="w-fit px-8 mx-auto mb-4"
        onClick={() => {
          setMode("staff");
          setActiveUID(STAFF_UID);
        }}
      >
        ESCALATE
      </Button>
    </div>
  );
}
