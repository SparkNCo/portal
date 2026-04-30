"use client";

import { useState } from "react";

type AssistantType = "support" | "ai";

type Props = {
  creating: boolean;
  onCreate: (title: string, type: AssistantType) => void;
  onClose: () => void;
};

export default function CreateChatModal({ creating, onCreate, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [assistantType, setAssistantType] = useState<AssistantType>("support");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onCreate(title.trim(), assistantType);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-background border rounded-2xl p-6 w-[360px] shadow-xl space-y-5">
        <div>
          <h2 className="font-semibold text-base">New Chat</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Give your chat a name and choose who to include.
          </p>
        </div>

        <input
          autoFocus
          className="w-full border rounded-lg px-3 py-2.5 text-sm bg-secondary/30 focus:outline-none focus:ring-2 focus:ring-accent/50"
          placeholder="Chat title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Chat type
          </p>
          <div className="flex flex-col gap-2">
            {(["support", "ai"] as const).map((type) => (
              <label
                key={type}
                aria-label={type === "support" ? "Support Developer" : "AI Agent"}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  assistantType === type
                    ? "border-accent bg-accent/10"
                    : "border-border hover:bg-secondary/40"
                }`}
              >
                <input
                  type="radio"
                  name="assistant"
                  value={type}
                  checked={assistantType === type}
                  onChange={() => setAssistantType(type)}
                  className="accent-black"
                />
                <div>
                  <div className="text-sm font-medium">
                    {type === "support" ? "Support Developer" : "AI Agent"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {type === "support"
                      ? "Group chat with your assigned developer"
                      : "Direct conversation with the AI assistant"}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 text-sm rounded-lg border hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={creating || !title.trim()}
            className="px-4 py-2 text-sm rounded-lg bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-40 transition-opacity font-medium"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
