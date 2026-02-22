"use client";

import { useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";

export default function AIGroupChat({ user }) {
  const AI_UID = process.env.NEXT_PUBLIC_COMET_AI_UID as string;

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [groupId, setGroupId] = useState<string>("");

  useEffect(() => {
    const createAIGroup = async () => {
      const GUID = "ai-group-" + crypto.randomUUID();
      setGroupId(GUID);

      try {
        const group = new CometChat.Group(
          GUID,
          "AI Session",
          CometChat.GROUP_TYPE.PUBLIC,
        );

        await CometChat.createGroup(group);
        // 2️⃣ Add AI bot

        let membersList = [
          new CometChat.GroupMember(
            AI_UID,
            CometChat.GROUP_MEMBER_SCOPE.PARTICIPANT,
          ),
        ];

        await CometChat.addMembersToGroup(GUID, membersList, []).then(
          (response) => {
            console.log("response", response);
          },
          (error) => {
            console.log("Something went wrong", error);
          },
        );

        console.log("🤖 AI joined group");
      } catch (err) {
        console.error("Group creation error:", err);
      }
    };

    createAIGroup();
  }, []);

  // 🤖 AI streaming listener
  useEffect(() => {
    const listenerId = "ai-group-listener";
    let streamingText = "";

    CometChat.addAIAssistantListener(listenerId, {
      onAIAssistantEventReceived: (event) => {
        const delta = event?.data?.delta;
        if (!delta) return;

        streamingText += delta;

        setMessages((prev) => {
          const last = prev[prev.length - 1];

          if (last?.sender?.uid === "AI") {
            const updated = [...prev];
            updated[updated.length - 1].text = streamingText;
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
  }, []);

  // 📤 Send message to group
  const sendMessage = async () => {
    if (!message.trim() || !groupId) return;

    setLoading(true);

    try {
      const textMessage = new CometChat.TextMessage(
        groupId,
        message,
        CometChat.RECEIVER_TYPE.GROUP,
      );

      textMessage.setMetadata({
        sessionId: groupId,
        senderUid: user?.uid,
        type: "ai-group-session",
      });

      const sent = await CometChat.sendMessage(textMessage);

      setMessages((prev) => [...prev, sent]);
      setMessage("");
    } catch (err) {
      console.error("Send message error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto border rounded-xl h-[500px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((msg, i) => {
          const isAI = msg.sender?.uid === "AI";

          return (
            <div
              key={i}
              className={`p-2 rounded-lg max-w-[70%] text-white ${
                isAI ? "bg-blue-600" : "bg-green-600 ml-auto"
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
          Send
        </button>
      </div>
    </div>
  );
}
