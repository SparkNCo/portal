"use client";

import { useEffect, useRef, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";

type AIGroupChatProps = {
  user: CometChat.User;
};

type ChatMessage = {
  id: string;
  uid: string;
  text: string;
};

export default function AIGroupChat({ user: _ }: AIGroupChatProps) {
  // const AI_UID = process.env.NEXT_PUBLIC_COMET_AI_UID as string;
  const AI_UID = "e17fda15-1881-4375-a818-21fb97a507ce";
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 🤖 Listen for all incoming messages and log them
  useEffect(() => {
    const listenerId = "ai-direct-listener";

    CometChat.addMessageListener(
      listenerId,
      new CometChat.MessageListener({
        onTextMessageReceived: (msg: CometChat.TextMessage) => {
          const senderUID = msg.getSender()?.getUid();
          const text = msg.getText();
          console.log("📩 [TextMessage received]", {
            senderUID,
            text,
            messageId: msg.getId(),
            receiverType: msg.getReceiverType(),
            raw: msg,
          });

          if (senderUID !== AI_UID) {
            console.log("⏭️ Ignoring message from:", senderUID);
            return;
          }

          console.log("✅ AI reply received:", text);
          setMessages((prev) => [
            ...prev,
            { id: String(msg.getId()), uid: AI_UID, text },
          ]);
        },
        onCustomMessageReceived: (msg: CometChat.CustomMessage) => {
          console.log("📦 [CustomMessage received]", {
            senderUID: msg.getSender()?.getUid(),
            type: msg.getType(),
            data: msg.getData(),
            raw: msg,
          });
        },
      }),
    );

    console.log("👂 Message listener registered:", listenerId);

    return () => {
      CometChat.removeMessageListener(listenerId);
      console.log("🔇 Message listener removed:", listenerId);
    };
  }, []);

  // 📤 Send message directly to AI_UID
  const sendMessage = async () => {
    if (!message.trim()) return;
    setLoading(true);

    try {
      const textMessage = new CometChat.TextMessage(
        AI_UID,
        message,
        CometChat.RECEIVER_TYPE.USER,
      );

      const sent = await CometChat.sendMessage(textMessage) as CometChat.TextMessage;
      const sentText = sent.getText();
      console.log("📤 Message sent:", { text: sentText, raw: sent });

      setMessages((prev) => [
        ...prev,
        { id: String(sent.getId()), uid: sent.getSender()?.getUid() ?? "me", text: sentText },
      ]);
      setMessage("");
    } catch (err) {
      console.error("❌ Send message error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto border rounded-xl h-[500px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => {
          const isAI = msg.uid === AI_UID;
          return (
            <div
              key={msg.id}
              className={`p-2 rounded-lg max-w-[70%] text-white ${
                isAI ? "bg-blue-600" : "bg-green-600 ml-auto"
              }`}
            >
              {msg.text}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex border-t p-2 gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2"
          placeholder="Talk to your AI agent..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-black text-white px-4 rounded-lg"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
