import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import type { Dispatch, SetStateAction } from "react";

type ChatMode = "response" | "ai" | "staff";
type Conversation = any;

type ChatSideBarProps = {
  user: CometChat.User | null;

  setConversationId: Dispatch<SetStateAction<string | null>>;
  setMode: Dispatch<SetStateAction<ChatMode>>;
  setActiveUID: Dispatch<SetStateAction<string | null>>;
  setResponseConversation: Dispatch<SetStateAction<Conversation | null>>;
};

export default function ChatSideBar({
  user,
  setConversationId,
  setMode,
  setActiveUID,
  setResponseConversation,
}: ChatSideBarProps) {
  const [conversationsAPI, setConversationsAPI] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    loadConversations();
  }, [user]);

  const loadConversations = async () => {
    try {
      const limit = 50;

      const conversationsRequest = new CometChat.ConversationsRequestBuilder()
        .setLimit(limit)
        .build();

      const conversationList = await conversationsRequest.fetchNext();

      // ✅ Save in global state
      setConversationsAPI(conversationList);
      console.log("📚 Conversations API response:");
      console.log(conversationList);
    } catch (error) {
      console.error("❌ Error loading conversations:", error);
    }
  };

  return (
    <div className="w-80 border-r flex flex-col bg-black">
      <div className="p-4 font-bold border-b">Conversations</div>
      <div className="flex-1 overflow-y-auto">
        {conversationsAPI.map((conv, i) => {
          const otherUser = conv.conversationWith;

          return (
            <div
              key={i}
              onClick={() => {
                setConversationId(conv.conversationId);
                setMode("response");
                setActiveUID(otherUser.guid || otherUser.uid);
                setResponseConversation({
                  type: "staff",
                  text: conv.lastMessage.rawMessage.text,
                  from: conv.conversationWith.name,
                  uid: conv.conversationWith.uid,
                });
              }}
              className="p-3 border-b cursor-pointer hover:bg-gray-200"
            >
              <div className="font-medium">{otherUser.name}</div>

              <div className="text-xs opacity-70 truncate">
                {conv.lastMessage?.text || "No messages"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
