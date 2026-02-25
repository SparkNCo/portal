"use client";

import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";

export default function StaffChatInput() {
  const ADMIN_UID = process.env.NEXT_PUBLIC_COMET_ADMIN_UID as string;

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 👂 Listen for staff messages
  useEffect(() => {
    const listenerId = "staff-chat-listener";

    CometChat.addMessageListener(
      listenerId,
      new CometChat.MessageListener({
        onTextMessageReceived: (msg: CometChat.TextMessage) => {
          // Only accept messages from admin
          if (msg.getSender()?.getUid() === ADMIN_UID) {
            setMessages((prev) => [...prev, msg]);
          }
        },
      }),
    );

    return () => {
      CometChat.removeMessageListener(listenerId);
    };
  }, []);

  // 📤 Send message to staff
  const sendMessage = async () => {
    if (!message.trim()) return;

    setLoading(true);

    try {
      const textMessage = new CometChat.TextMessage(
        ADMIN_UID,
        message,
        CometChat.RECEIVER_TYPE.USER,
      );

      const sent = await CometChat.sendMessage(textMessage);

      setMessages((prev) => [...prev, sent]);
      setMessage("");
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto border rounded-xl h-[500px]">
      {/* Messages */}

      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-transparent">
        {messages.map((msg, i) => {
          const isAdmin = msg.sender?.uid === ADMIN_UID;

          return (
            <div
              key={i}
              className={`p-2 rounded-lg max-w-[70%] text-white ${
                isAdmin ? "bg-blue-600" : "bg-green-600 ml-auto"
              }`}
            >
              {msg.text}
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex border-t p-2 gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2"
          placeholder="Talk with support..."
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
