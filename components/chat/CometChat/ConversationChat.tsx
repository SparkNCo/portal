"use client";

import { useEffect, useRef, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";

type Props = {
  user: any;
  notification: {
    uid: string;
    from: string;
  };
};

export default function ConversationChat({ user, notification }: Props) {
  const staffUID = notification?.uid;
  const AI_UID = process.env.NEXT_PUBLIC_COMET_AI_UID || "AI";

  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // 🧠 Streaming buffers
  const streamRef = useRef("");
  const aiMessageIdRef = useRef<string | null>(null);

  // =========================
  // 1️⃣ Fetch history
  // =========================
  useEffect(() => {
    if (!user || !staffUID) return;

    const fetchMessages = async () => {
      try {
        setLoading(true);

        const request = new CometChat.MessagesRequestBuilder()
          .setUID(staffUID)
          .setLimit(50)
          .build();

        const msgs = await request.fetchPrevious();
        setMessages(msgs);
      } catch (err) {
        console.error("Messages fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [user, staffUID]);

  // =========================
  // 2️⃣ Normal messages listener
  // =========================
  useEffect(() => {
    if (!staffUID) return;

    const listenerID = `chat-${staffUID}`;

    CometChat.addMessageListener(
      listenerID,
      new CometChat.MessageListener({
        onTextMessageReceived: (msg: CometChat.TextMessage) => {
          const isThisChat =
            msg.getSender()?.getUid() === staffUID ||
            msg.getReceiverId() === staffUID;

          if (!isThisChat) return;

          setMessages((prev) => [...prev, msg]);
        },
      }),
    );

    return () => {
      CometChat.removeMessageListener(listenerID);
    };
  }, [staffUID]);

  // =========================
  // 3️⃣ AI streaming listener
  // =========================
  useEffect(() => {
    const listenerId = "ai-listener";

    CometChat.addAIAssistantListener(listenerId, {
      onAIAssistantEventReceived: (event) => {
        const type = event?.type || "";
        const { delta, finishReason } = event?.data || {};

        if (delta) {
          streamRef.current += delta;
        }

        setMessages((prev) => {
          const updated = [...prev];

          const index = updated.findIndex(
            (m) => m.id === aiMessageIdRef.current,
          );

          if (index !== -1) {
            updated[index] = {
              ...updated[index],
              text: streamRef.current,
              loading: type !== "run_started" ? false : true,
            };
          }

          return updated;
        });

        // ✅ Stream finished
        if (finishReason) {
          streamRef.current = "";
          aiMessageIdRef.current = null;
        }
      },
    });

    return () => {
      CometChat.removeAIAssistantListener(listenerId);
    };
  }, []);

  // =========================
  // 4️⃣ Send message
  // =========================
  const sendMessage = async () => {
    if (!message.trim()) return;

    try {
      // Reset stream buffer
      streamRef.current = "";

      // 1️⃣ User bubble
      const userMsg = {
        id: Date.now(),
        text: message,
        sender: { uid: user.uid },
      };

      setMessages((prev) => [...prev, userMsg]);

      // 2️⃣ Create AI typing bubble ONCE
      const aiId = `ai-${Date.now()}`;
      aiMessageIdRef.current = aiId;

      setMessages((prev) => [
        ...prev,
        {
          id: aiId,
          sender: { uid: AI_UID },
          text: "",
          loading: true,
        },
      ]);

      // 3️⃣ Send message
      const textMessage = new CometChat.TextMessage(
        staffUID,
        message,
        CometChat.RECEIVER_TYPE.USER,
      );

      await CometChat.sendMessage(textMessage);

      setMessage("");
    } catch (err) {
      console.error("Send error:", err);
    }
  };

  // =========================
  // ⏳ Initial loading
  // =========================
  if (loading) {
    return <div className="p-4">Loading conversation...</div>;
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto border rounded-xl h-[500px]">
      {/* Header */}
      <div className="p-3 border-b font-semibold">
        Chat with {notification.from}
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg, i) => {
          const isMe = msg.sender?.uid === user.uid;

          return (
            <div
              key={msg.id || i}
              className={`p-2 rounded-lg max-w-[70%] ${
                isMe
                  ? "bg-green-600 text-white ml-auto"
                  : "bg-blue-600 text-white"
              }`}
            >
              {msg.loading ? (
                <div className="flex gap-1 py-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-150" />
                  <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-300" />
                </div>
              ) : (
                msg.text || msg?.aiAssistantMessageData?.text
              )}
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex border-t p-2 gap-2">
        <input
          className="flex-1 border rounded-lg px-3 py-2"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />

        <button
          onClick={sendMessage}
          className="bg-black text-white px-4 rounded-lg"
        >
          Send
        </button>
      </div>
    </div>
  );
}
