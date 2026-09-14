"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MessageSquarePlus,
  FolderKanban,
  Pencil,
  Ticket,
  ChevronsUpDown,
  Loader2,
} from "lucide-react";
import { fetchIssues } from "@/app/[slug]/(portal)/dashboard/page";
import { getIssueCode, cn } from "@/lib/utils";

export type InitiativeOption = { id: string; label: string };
export type ChatIssueOption = { id: string; code: string; title: string };

type Props = {
  readonly creating: boolean;
  readonly initialTitle?: string;
  readonly onCreate: (title: string, initiativeId?: string, issue?: ChatIssueOption) => void;
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
  // Developers: locked to whichever project is currently selected in the
  // sidebar (see ChatLayout.tsx's selectedProjectCustomerId) — no free
  // choice here, so a chat started from "New Chat" always lines up with the
  // project the developer is actually looking at rather than accidentally
  // scoping it to a different one of their assignments. Admins get the free
  // dropdown as before (undefined here for them).
  readonly lockedInitiativeId?: string;
  // Customers: no Initiative section at all (they only ever have the one
  // implicit project) — issues are fetched directly from this slug instead
  // of being resolved through initiativeOptions/initiativeId.
  readonly fixedSlug?: string;
};

export default function CreateChatModal({
  creating,
  initialTitle,
  onCreate,
  onClose,
  requireInitiative,
  initiativeOptions = [],
  lockedInitiativeId,
  fixedSlug,
}: Props) {
  // Stakeholders (the only role left on requireInitiative=false) still type
  // their own title — there's no issue picker in that flow to derive one from.
  const [title, setTitle] = useState(initialTitle ?? "");
  const [initiativeId, setInitiativeId] = useState(lockedInitiativeId ?? "");
  const [issue, setIssue] = useState<ChatIssueOption | null>(null);
  const [issuePickerOpen, setIssuePickerOpen] = useState(false);

  // Every initiative option's `label` is already that customer's routing
  // slug (see ChatLayout.tsx — admin's customerOptions comes straight from
  // `users.userName`, set to `clientName` at account creation; developer's
  // falls back the same way) — no extra lookup needed to fetch its issues.
  // A customer has no initiativeId to resolve at all — fixedSlug is already
  // their own slug directly.
  const selectedSlug = fixedSlug ?? initiativeOptions.find((o) => o.id === initiativeId)?.label;

  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["chat-modal-issues", selectedSlug],
    queryFn: () => fetchIssues(selectedSlug!),
    enabled: !!selectedSlug,
  });

  const issueOptions: ChatIssueOption[] = useMemo(
    () =>
      ((issuesData ?? []) as { id: string; branchName: string; title: string }[])
        .filter((i) => i?.id)
        .map((i) => ({ id: i.id, code: getIssueCode(i.branchName), title: i.title })),
    [issuesData],
  );

  // Switching initiatives invalidates whatever ticket was picked for the
  // previous one — the picker itself resets to that initiative's own list.
  useEffect(() => {
    setIssue(null);
  }, [initiativeId]);

  // requireInitiative flow has no Title field of its own — the picked
  // ticket's own title becomes the chat's title, so picking one is what
  // makes the form submittable there (not a separately typed title). A
  // customer (fixedSlug) has no initiative to pick in the first place, so
  // only the ticket itself gates submission for them.
  const canSubmit = requireInitiative
    ? (!!fixedSlug || !!initiativeId) && !!issue
    : !!title.trim();

  const handleSubmit = () => {
    if (!canSubmit) return;
    const chatTitle = requireInitiative ? issue!.title.trim() : title.trim();
    onCreate(chatTitle, requireInitiative && !fixedSlug ? initiativeId : undefined, issue ?? undefined);
  };

  function handleSelectIssue(selected: ChatIssueOption) {
    setIssue(selected);
    setIssuePickerOpen(false);
  }

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
                {fixedSlug
                  ? "Start a chat about one of your tickets"
                  : requireInitiative
                    ? "Start a chat with everyone on an initiative"
                    : "Group chat with your assigned developers"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-4 mt-1 border-t border-border">
          {requireInitiative && !fixedSlug && (
            <div>
              <p className="flex items-center gap-1.5 smalltext font-medium text-foreground mb-1.5">
                <FolderKanban className="h-3.5 w-3.5 text-primary" />
                Initiative
              </p>
              {lockedInitiativeId ? (
                <div className="flex items-center rounded-lg bg-muted/40 px-3 py-2 smalltext text-foreground">
                  {initiativeOptions.find((o) => o.id === lockedInitiativeId)?.label ??
                    "Your selected project"}
                </div>
              ) : initiativeOptions.length > 0 ? (
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

          {requireInitiative && (
            <div>
              <p className="flex items-center gap-1.5 smalltext font-medium text-foreground mb-1.5">
                <Ticket className="h-3.5 w-3.5 text-primary" />
                Ticket
              </p>
              <Popover open={issuePickerOpen} onOpenChange={setIssuePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!selectedSlug}
                    className="w-full justify-between smalltext bg-secondary border-0 font-normal"
                  >
                    <span className={cn("truncate", !issue && "text-muted-foreground")}>
                      {issue
                        ? `${issue.code} — ${issue.title}`
                        : selectedSlug
                          ? "Search by title or code..."
                          : "Select an initiative first"}
                    </span>
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[28rem] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by title or ticket code…" />
                    <CommandList>
                      {issuesLoading && (
                        <div className="flex items-center gap-2 px-3 py-3 smalltext text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Loading tickets…
                        </div>
                      )}
                      {!issuesLoading && (
                        <CommandEmpty className="py-3 px-3 smalltext text-muted-foreground">
                          No tickets found.
                        </CommandEmpty>
                      )}
                      <CommandGroup>
                        {issueOptions.map((opt) => (
                          <CommandItem
                            key={opt.id}
                            value={`${opt.code} ${opt.title}`}
                            onSelect={() => handleSelectIssue(opt)}
                            className="smalltext py-2"
                          >
                            <span className="font-mono text-muted-foreground shrink-0 mr-2">
                              {opt.code}
                            </span>
                            <span className="truncate">{opt.title}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {!requireInitiative && (
            <div className="space-y-1.5">
              <Label htmlFor="chat-title" className="flex items-center gap-1.5 smalltext font-medium text-foreground">
                <Pencil className="h-3.5 w-3.5 text-primary" />
                Title
              </Label>
              <Input
                id="chat-title"
                autoFocus
                className="smalltext bg-secondary border-0"
                placeholder="Chat title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
          )}

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
