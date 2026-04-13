"use client";
import { useEffect, useState } from "react";
import Chat from "./Chat";
// import ChatSideBar from "./ChatSideBar";
import { CometChat } from "@cometchat/chat-sdk-javascript";

export default function ChatLayout() {
  const [libraryImported, setLibraryImported] = useState(false);
  const [user, setUser] = useState<CometChat.User | null>(null);
  const [responseConversation, setResponseConversation] = useState<{} | null>(
    null,
  );
  const [mode, setMode] = useState<"ai" | "staff" | "response">("ai");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeUID, setActiveUID] = useState<string | null>(null);

  const [notification, setNotification] = useState<{
    type: "ai" | "staff";
    text: string;
    from: string;
    uid: string;
  } | null>(null);

  useEffect(() => {
    window.CometChat = require("@cometchat/chat-sdk-javascript").CometChat;
    setLibraryImported(true);
  }, []);

  return libraryImported ? (
    <div className="flex flex-row w-full">
      {/* Sidebar */}
      {/* <ChatSideBar
        user={user}
        setConversationId={setConversationId}
        setMode={setMode}
        setActiveUID={setActiveUID}
        setResponseConversation={setResponseConversation}
      /> */}

      {/* Chat Window */}
      <Chat
        user={user}
        setUser={setUser}
        mode={mode}
        setMode={setMode}
        conversationId={conversationId}
        setConversationId={setConversationId}
        activeUID={activeUID}
        setActiveUID={setActiveUID}
        notification={notification}
        setNotification={setNotification}
        responseConversation={responseConversation}
        setResponseConversation={setResponseConversation}
      />
    </div>
  ) : (
    <p>Loading....</p>
  );
}
