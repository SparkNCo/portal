"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronsUpDown, Clock, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DialogFooterActions } from "@/components/shared/dialog-footer-actions";
import { ExpandableDialogChrome } from "@/components/shared/expandable-dialog-chrome";
import { NumberStepper } from "@/components/shared/number-stepper";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { cn } from "@/lib/utils";
import {
  deleteLogHours,
  patchLogHours,
  postLogHours,
  type HoursLogEntry,
} from "@/lib/hours-api";

type Project = { clientName: string; slug: string; allocation?: number | null };

// Same field chrome as Add Developer / edit-issue-modal: a cream input sitting
// flush on the modal's own background instead of an outlined box. Also opts
// every field into this modal's type scale (smalltext = 16px) instead of the
// primitives' own baked-in text-sm (14px) — smalltext's `!important` is what
// lets it win over that.
const fieldClass = "bg-secondary border-0 smalltext";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export function LogHoursModal({
  projects,
  issues,
  developerId,
  developerEmail,
  entry,
  onClose,
  onChanged,
}: {
  readonly projects: Project[];
  // Raw Linear issue objects (as returned by fetchIssues), each tagged with `_project`
  // matching a project's clientName — same shape the developer dashboard already fetches
  // for its issue list, reused here to scope the tickets picker per selected project.
  readonly issues: any[];
  readonly developerId: string;
  readonly developerEmail: string;
  // When set, the modal edits (and can delete) this existing entry instead of
  // creating a new one — the caller must confirm `entry.developer_id === developerId`
  // before rendering this (the backend re-checks ownership regardless).
  readonly entry?: HoursLogEntry;
  readonly onClose: () => void;
  // Called after a successful create/update/delete, in addition to closing —
  // use this to refetch whatever list is showing logged entries.
  readonly onChanged?: () => void;
}) {
  const isEditing = !!entry;

  const [isExpanded, setIsExpanded] = useState(false);
  const [projectSlug, setProjectSlug] = useState(
    entry?.project_slug ?? (projects.length === 1 ? projects[0]!.slug : ""),
  );
  const [hours, setHours] = useState(entry ? String(entry.hours) : "");
  const [workedOn, setWorkedOn] = useState(entry?.worked_on ?? todayISODate());
  const [ticketIds, setTicketIds] = useState<string[]>(entry?.issue_ids ?? []);
  const [ticketPickerOpen, setTicketPickerOpen] = useState(false);
  const [summary, setSummary] = useState(entry?.summary ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const selectedProject = projects.find((p) => p.slug === projectSlug) ?? null;

  const ticketOptions = useMemo(() => {
    if (!selectedProject) return [];
    return issues
      .filter((i) => i._project === selectedProject.clientName)
      .map((i) => ({
        id: i.id as string,
        code: (i.identifier as string) ?? null,
        title: i.title as string,
      }));
  }, [issues, selectedProject]);

  // Already-picked tickets drop out of the dropdown entirely instead of just
  // graying out — the chips below are the only place they still show.
  const pickableTicketOptions = ticketOptions.filter((o) => !ticketIds.includes(o.id));

  // A previously-selected ticket might not be in `ticketOptions` anymore (e.g. it's
  // since been marked Done and dropped from the dashboard's active issue list) —
  // still show its chip so removing it stays possible, just without a friendly label.
  function ticketOption(id: string) {
    return ticketOptions.find((o) => o.id === id) ?? { id, code: null, title: id };
  }

  // Shared by the dropdown list and the selected-ticket chips so both always
  // show the exact same text for a given ticket.
  function ticketDisplayLabel(option: { code: string | null; title: string }) {
    return option.code ? `${option.code} — ${option.title}` : option.title;
  }

  const createMutation = useMutation({
    mutationFn: postLogHours,
    onSuccess: () => {
      toast.success("Hours logged");
      onChanged?.();
      onClose();
    },
    onError: () => toast.error("Failed to save. Please try again."),
  });

  const updateMutation = useMutation({
    mutationFn: patchLogHours,
    onSuccess: () => {
      toast.success("Hours updated");
      onChanged?.();
      onClose();
    },
    onError: () => toast.error("Failed to save. Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteLogHours(entry!.id, developerId),
    onSuccess: () => {
      toast.success("Entry deleted");
      onChanged?.();
      onClose();
    },
    onError: () => toast.error("Failed to delete. Please try again."),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const parsedHours = Number(hours);
  const hoursValid = Number.isInteger(parsedHours) && parsedHours > 0;
  const canSubmit = hoursValid && !!selectedProject && !!workedOn;

  function handleSubmit() {
    if (!canSubmit || !selectedProject) return;
    const shared = {
      hours: parsedHours,
      worked_on: workedOn,
      project_slug: selectedProject.slug,
      project_name: selectedProject.clientName,
      issue_ids: ticketIds,
      summary: summary.trim() || undefined,
    };
    if (isEditing) {
      updateMutation.mutate({ id: entry!.id, developer_id: developerId, ...shared });
    } else {
      createMutation.mutate({ developer_id: developerId, developer_email: developerEmail, ...shared });
    }
  }

  function toggleTicket(id: string) {
    setTicketIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={`w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto overflow-x-hidden transition-all duration-200 ${
          isExpanded
            ? "sm:max-w-2xl md:max-w-4xl lg:max-w-5xl"
            : "sm:max-w-lg md:max-w-xl lg:max-w-2xl"
        }`}
        aria-describedby={undefined}
      >
        <ExpandableDialogChrome
          isExpanded={isExpanded}
          onToggleExpanded={() => setIsExpanded((e) => !e)}
        />

        <DialogHeader className="pt-4">
          <DialogTitle className="body flex items-center gap-2 text-primary">
            {isEditing ? <Pencil className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
            {isEditing ? "Edit Hours" : "Log Hours"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="log-hours-hours" className="smalltext">Hours</Label>
              <NumberStepper
                id="log-hours-hours"
                min={1}
                step={1}
                value={hours}
                onChange={setHours}
                onBump={(delta) => setHours(String(Math.max(1, (Number.parseInt(hours, 10) || 0) + delta)))}
                placeholder="e.g. 4"
                autoFocus
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="log-hours-date" className="smalltext">Date</Label>
              <Input
                id="log-hours-date"
                type="date"
                value={workedOn}
                max={todayISODate()}
                onChange={(e) => setWorkedOn(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="log-hours-project" className="smalltext">Project</Label>
            <Select
              value={projectSlug}
              onValueChange={(v) => {
                setProjectSlug(v);
                setTicketIds([]);
              }}
            >
              <SelectTrigger id="log-hours-project" className={fieldClass}>
                <SelectValue placeholder="Select a project…" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.slug} value={p.slug} className="smalltext">
                    {p.clientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="smalltext">
              Tickets <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Popover open={ticketPickerOpen} onOpenChange={setTicketPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  disabled={!selectedProject}
                  className={cn(fieldClass, "w-full justify-between font-normal")}
                >
                  <span className="truncate">
                    {!selectedProject
                      ? "Select a project first"
                      : ticketIds.length === 0
                        ? "Select tickets…"
                        : `${ticketIds.length} ticket${ticketIds.length === 1 ? "" : "s"} selected`}
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Search tickets…" className="smalltext" />
                  <CommandList>
                    <CommandEmpty className="py-3 smalltext text-muted-foreground">
                      {ticketOptions.length > 0 ? "All tickets added." : "No tickets found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {pickableTicketOptions.map((option) => (
                        <CommandItem
                          key={option.id}
                          value={ticketDisplayLabel(option)}
                          onSelect={() => toggleTicket(option.id)}
                          className="smalltext"
                        >
                          <span className="truncate text-popover-foreground">
                            {ticketDisplayLabel(option)}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {ticketIds.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                {ticketIds.map((id) => {
                  const option = ticketOption(id);
                  return (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="smalltext flex w-full items-center justify-between gap-1.5 rounded-md py-1.5 pl-2.5 pr-1"
                    >
                      <span className="min-w-0 truncate">{ticketDisplayLabel(option)}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${ticketDisplayLabel(option)}`}
                        onClick={() => toggleTicket(id)}
                        className="shrink-0 rounded-full p-0.5 text-muted-foreground outline-none transition-colors hover:bg-muted-foreground/20 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="smalltext">
              Summary <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <RichTextEditor
              value={summary}
              onChange={setSummary}
              placeholder="What did you work on?"
              className="border-0"
              minHeight="90px"
              ariaLabel="Summary"
            />
          </div>

          {isEditing && confirmingDelete ? (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="smalltext text-foreground">Delete this entry? This can't be undone.</p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="smalltext"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleteMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="smalltext"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 pt-1">
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 text-destructive hover:text-destructive"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={isSaving}
                  aria-label="Delete entry"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <div className="flex-1">
                <DialogFooterActions
                  onCancel={onClose}
                  onSubmit={handleSubmit}
                  submitDisabled={!canSubmit}
                  pending={isSaving}
                  submitLabel={isEditing ? "Save changes" : "Log hours"}
                  buttonClassName="smalltext"
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
