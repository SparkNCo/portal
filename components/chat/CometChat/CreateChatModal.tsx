"use client";

import { useState } from "react";

type Props = {
  readonly creating: boolean;
  readonly initialTitle?: string;
  readonly onCreate: (title: string) => void;
  readonly onClose: () => void;
};

export default function CreateChatModal({ creating, initialTitle, onCreate, onClose }: Props) {
  const [title, setTitle] = useState(initialTitle ?? "");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onCreate(title.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-background border rounded-2xl p-6 w-[360px] shadow-xl space-y-5">
        <div>
          <h2 className="font-semibold text-base">New Chat</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Group chat with your assigned developer
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
