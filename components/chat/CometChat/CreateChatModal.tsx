"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type InitiativeOption = { id: string; label: string };

type Props = {
  readonly creating: boolean;
  readonly initialTitle?: string;
  readonly onCreate: (title: string, initiativeId?: string) => void;
  readonly onClose: () => void;
  // True for developers/admins, who have no single home initiative and must
  // pick one — everyone assigned to it gets added as a member. False (or
  // omitted) for customers/stakeholders, who each only ever have one
  // implicit initiative and keep the old title-only flow. Kept separate from
  // initiativeOptions itself (which can be empty while still loading, or
  // genuinely empty for a developer with no assignments) so an empty list
  // shows "no initiatives" instead of silently falling back to the old
  // flow and creating a group with nobody in it.
  readonly requireInitiative?: boolean;
  readonly initiativeOptions?: InitiativeOption[];
};

export default function CreateChatModal({
  creating,
  initialTitle,
  onCreate,
  onClose,
  requireInitiative,
  initiativeOptions = [],
}: Props) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [initiativeId, setInitiativeId] = useState("");

  const canSubmit = !!title.trim() && (!requireInitiative || !!initiativeId);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onCreate(title.trim(), requireInitiative ? initiativeId : undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-background border border-primary/30 rounded-2xl p-6 w-[360px] shadow-xl space-y-5">
        <div>
          <h2 className="font-semibold text-base text-primary">New Chat</h2>
          <p className="text-xs md:smalltext text-muted-foreground mt-0.5">
            {requireInitiative
              ? "Start a chat with everyone on an initiative"
              : "Group chat with your assigned developers"}
          </p>
        </div>

        {requireInitiative && (
          <div className="space-y-1.5">
            <label className="text-xs md:smalltext font-medium text-primary">
              Initiative
            </label>
            {initiativeOptions.length > 0 ? (
              <Select value={initiativeId} onValueChange={setInitiativeId}>
                <SelectTrigger className="bg-secondary/30 border-primary/30 focus:ring-primary">
                  <SelectValue placeholder="Select an initiative..." />
                </SelectTrigger>
                <SelectContent>
                  {initiativeOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs md:smalltext text-muted-foreground">
                No initiatives found — you need to be assigned to one first.
              </p>
            )}
          </div>
        )}

        <Input
          autoFocus={!requireInitiative}
          className="bg-secondary/30 border-primary/30 focus-visible:ring-primary"
          placeholder="Chat title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 text-sm md:smalltext rounded-lg border border-primary/30 hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={creating || !canSubmit}
            className="px-4 py-2 text-sm md:smalltext rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors font-medium"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
