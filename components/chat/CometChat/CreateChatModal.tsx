"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquarePlus, FolderKanban, Pencil } from "lucide-react";

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
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="w-[95vw] sm:w-full sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden"
        aria-describedby={undefined}
      >
        {/* Orange accent bar ties the modal back to the card it was opened from. */}
        <div className="-mx-6 -mt-6 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

        <DialogHeader className="pt-4">
          <div className="flex min-w-0 items-center gap-3.5 pr-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-2 ring-primary/30">
              <MessageSquarePlus className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="truncate text-primary">New Chat</DialogTitle>
              <p className="smalltext text-muted-foreground">
                {requireInitiative
                  ? "Start a chat with everyone on an initiative"
                  : "Group chat with your assigned developers"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-4 mt-1 border-t border-border">
          {requireInitiative && (
            <div>
              <p className="flex items-center gap-1.5 smalltext font-medium text-foreground mb-1.5">
                <FolderKanban className="h-3.5 w-3.5 text-primary" />
                Initiative
              </p>
              {initiativeOptions.length > 0 ? (
                <Select value={initiativeId} onValueChange={setInitiativeId}>
                  <SelectTrigger className="smalltext bg-secondary border-0">
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
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="smalltext text-muted-foreground">
                    No initiatives found — you need to be assigned to one first.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="chat-title" className="flex items-center gap-1.5 smalltext font-medium text-foreground">
              <Pencil className="h-3.5 w-3.5 text-primary" />
              Title
            </Label>
            <Input
              id="chat-title"
              autoFocus={!requireInitiative}
              className="smalltext bg-secondary border-0"
              placeholder="Chat title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="smalltext"
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="smalltext"
              onClick={handleSubmit}
              disabled={creating || !canSubmit}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
