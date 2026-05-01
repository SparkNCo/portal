"use client";

import { useState } from "react";

type AssistantType = "support" | "ai";

type Props = {
  readonly creating: boolean;
  readonly initialTitle?: string;
  readonly onCreate: (title: string, type: AssistantType) => void;
  readonly onClose: () => void;
};

export default function CreateChatModal({ creating, initialTitle, onCreate, onClose }: Props) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [assistantType] = useState<AssistantType>("support");

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
            <label
              aria-label="Support Developer"
              className="flex items-center gap-3 p-3 rounded-lg border border-accent bg-accent/10 cursor-default"
            >
              <input
                type="radio"
                name="assistant"
                value="support"
                checked
                readOnly
                className="accent-black"
              />
              <div>
                <div className="text-sm font-medium">Support Developer</div>
                <div className="text-xs text-muted-foreground">
                  Group chat with your assigned developer
                </div>
              </div>
            </label>

            {/* AI Agent — hidden for now */}
            {/* <label
              aria-label="AI Agent"
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                assistantType === "ai"
                  ? "border-accent bg-accent/10"
                  : "border-border hover:bg-secondary/40"
              }`}
            >
              <input
                type="radio"
                name="assistant"
                value="ai"
                checked={assistantType === "ai"}
                onChange={() => setAssistantType("ai")}
                className="accent-black"
              />
              <div>
                <div className="text-sm font-medium">AI Agent</div>
                <div className="text-xs text-muted-foreground">
                  Direct conversation with the AI assistant
                </div>
              </div>
            </label> */}
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
