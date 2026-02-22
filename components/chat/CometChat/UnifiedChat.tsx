"use client";

import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";

type ChatType = "ai" | "staff";

export default function UnifiedChatInput({
  user,
  receiverUID,
  type,
}: {
  user: any;
  receiverUID: string;
  type: ChatType;
}) {
  const ADMIN_UID = process.env.NEXT_PUBLIC_COMET_ADMIN_UID as string;

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // =========================
  // LISTENERS
  // =========================
  useEffect(() => {
    // 🤖 AI LISTENER (streaming)
    if (type === "ai") {
      const listenerId = "ai-assistant-listener";

      let streamingText = "";

      CometChat.addAIAssistantListener(listenerId, {
        onAIAssistantEventReceived: (event) => {
          const delta = event?.data?.delta;
          if (!delta) return;

          streamingText += delta;

          setMessages((prev) => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            const lastMsg = updated[lastIndex];

            if (lastMsg?.sender?.uid === "AI") {
              setLoading(false);

              updated[lastIndex] = {
                ...lastMsg,
                text: streamingText,
                loading: false,
              };

              return updated;
            }

            return [
              ...prev,
              {
                sender: { uid: "AI" },
                text: streamingText,
              },
            ];
          });
        },
      });

      return () => {
        CometChat.removeAIAssistantListener(listenerId);
      };
    }

    // 👨‍💼 STAFF LISTENER
    if (type === "staff") {
      const listenerId = "staff-chat-listener";

      CometChat.addMessageListener(
        listenerId,
        new CometChat.MessageListener({
          onTextMessageReceived: (msg) => {
            if (msg.sender.uid === ADMIN_UID) {
              setMessages((prev) => [...prev, msg]);
            }
          },
        }),
      );

      return () => {
        CometChat.removeMessageListener(listenerId);
      };
    }
  }, [type]);

  // =========================
  // SEND MESSAGE
  // =========================
  const sendMessage = async () => {
    if (!message.trim()) return;

    setLoading(true);

    try {
      const textMessage = new CometChat.TextMessage(
        receiverUID,
        message,
        CometChat.RECEIVER_TYPE.USER,
      );

      const sent = await CometChat.sendMessage(textMessage);

      // Add my message
      setMessages((prev) => [...prev, sent]);

      // 🤖 Add AI loading bubble
      if (type === "ai") {
        setMessages((prev) => [
          ...prev,
          {
            id: "ai-loading",
            sender: { uid: "AI" },
            text: "...",
            loading: true,
          },
        ]);
      }

      setMessage("");
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      if (type === "staff") {
        setLoading(false);
      }
    }
  };

  // =========================
  // RENDER
  // =========================
  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto border rounded-xl h-[500px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-transparent">
        {messages.map((msg, i) => {
          const isAI =
            msg.sender?.uid === "AI" ||
            msg.sender?.uid === ADMIN_UID;

          return (
            <div
              key={i}
              className={`p-2 rounded-lg max-w-[70%] text-white flex items-center gap-1 ${
                isAI ? "bg-blue-600" : "bg-green-600 ml-auto"
              }`}
            >
              {/* 🤖 AI typing bubble */}
              {msg.loading ? (
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-150" />
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-300" />
                </div>
              ) : (
                msg.text
              )}
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex border-t p-2 gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2"
          placeholder={
            type === "ai"
              ? "Ask the AI something..."
              : "Talk with support..."
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />

        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-black text-white px-4 rounded-lg"
        >
          Send
        </button>
      </div>
    </div>
  );
}
