"use client";
import React, { useEffect, useState } from "react";
import Chat from "./Chat";
import ChatSideBar from "./ChatSideBar";

export default function ChatLayout() {
  const [libraryImported, setLibraryImported] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [responseConversation, setResponseConversation] = useState<{} | null>(
    null,
  );
  const [mode, setMode] = useState<"ai" | "staff" | "response">("ai");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeUID, setActiveUID] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);

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
    <div className="border-4 border-red-900 flex flex-row w-full">
      {/* Sidebar */}
      <ChatSideBar
        user={user}
        setUser={setUser}
        conversations={conversations}
        setConversationId={setConversationId}
        setMode={setMode}
        setActiveUID={setActiveUID}
        notification={notification}
        setNotification={setNotification}
        responseConversation={responseConversation}
        setResponseConversation={setResponseConversation}
      />

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
        conversations={conversations}
        setConversations={setConversations}
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
