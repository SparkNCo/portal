"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { supabase } from "@/lib/supabase-client";
import { TechStackPicker } from "@/components/shared/tech-stack-picker";
import { DialogFooterActions } from "@/components/shared/dialog-footer-actions";
import type { DeveloperDetails } from "./developer-details-modal";

const textareaClass =
  "w-full rounded-md border-0 bg-secondary p-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px] resize-none";

async function updateInternalDeveloper(payload: {
  userId: string;
  assignmentId?: string;
  email?: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  bio: string;
  techStack: string[];
  allocation: number;
}) {
  // Changing the email also updates the user's Supabase Auth login
  // credential server-side, so this needs the caller's real session token
  // (not the anon key) — the backend uses it to verify they're staffed on
  // the same initiative as the developer they're editing. Only sent when it
  // actually changed, so an unrelated edit (bio, allocation, ...) never
  // touches the login credential path.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users`, {
    method: "PATCH",
    headers: {
      ...API_JSON_HEADERS,
      Authorization: `Bearer ${session?.access_token ?? ""}`,
    },
    body: JSON.stringify({
      id: payload.userId,
      ...(payload.email && { email: payload.email }),
      firstName: payload.firstName || null,
      lastName: payload.lastName || null,
      phoneNumber: payload.phoneNumber || null,
    }),
  });
  if (!userRes.ok) {
    const body = await userRes.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to update developer details");
  }

  const profileRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=developer-profile`,
    {
      method: "PATCH",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({
        userId: payload.userId,
        bio: payload.bio || null,
        tech_stack: payload.techStack,
      }),
    },
  );
  if (!profileRes.ok) throw new Error("Failed to update bio/tech stack");

  if (payload.assignmentId) {
    const assignmentRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments`,
      {
        method: "PATCH",
        headers: API_JSON_HEADERS,
        body: JSON.stringify({ id: payload.assignmentId, allocation: payload.allocation }),
      },
    );
    if (!assignmentRes.ok) throw new Error("Failed to update weekly hours");
  }
}

export function EditInternalDeveloperModal({
  developer,
  customerId,
  onClose,
}: {
  readonly developer: DeveloperDetails;
  readonly customerId: string;
  readonly onClose: () => void;
}) {
  const [email, setEmail] = useState(developer.email ?? "");
  const [firstName, setFirstName] = useState(developer.firstName ?? "");
  const [lastName, setLastName] = useState(developer.lastName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(developer.phoneNumber ?? "");
  const [bio, setBio] = useState(developer.bio ?? "");
  const [techStack, setTechStack] = useState<string[]>(developer.techStack ?? []);
  const [allocation, setAllocation] = useState(String(developer.hours ?? ""));
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isAllocationValid = allocation.trim() !== "" && Number(allocation) > 0;

  const mutation = useMutation({
    mutationFn: () =>
      updateInternalDeveloper({
        userId: developer.userId!,
        assignmentId: developer.assignmentId,
        email: email.trim() !== (developer.email ?? "").trim() ? email.trim() : undefined,
        firstName,
        lastName,
        phoneNumber,
        bio,
        techStack,
        allocation: Number(allocation),
      }),
    onSuccess: () => {
      toast.success("Developer updated");
      queryClient.invalidateQueries({ queryKey: ["assignments", customerId] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to update developer"),
  });

  function handleSubmit() {
    setSubmitted(true);
    if (!isEmailValid || !isAllocationValid || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="w-[95vw] sm:w-full sm:max-w-lg max-h-[85vh] overflow-y-auto"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Pencil className="h-4 w-4" />
            Edit {developer.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-secondary border-0"
              placeholder="e.g. jane@example.com"
            />
            {submitted && !isEmailValid && (
              <p className="text-sm text-destructive">Enter a valid email address.</p>
            )}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1.5">
              <Label>
                First Name{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="bg-secondary border-0"
                placeholder="e.g. Jane"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>
                Last Name{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-secondary border-0"
                placeholder="e.g. Smith"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Phone Number{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              value={phoneNumber}
              onChange={(e) =>
                setPhoneNumber(e.target.value.replaceAll(/[^0-9+\-() ]/g, ""))
              }
              className="bg-secondary border-0"
              placeholder="e.g. (555) 123-4567"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Weekly Allocation (Hours)</Label>
            <Input
              type="number"
              min={1}
              value={allocation}
              onChange={(e) => setAllocation(e.target.value)}
              className="bg-secondary border-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              placeholder="e.g. 20"
            />
            {submitted && !isAllocationValid && (
              <p className="text-sm text-destructive">
                Enter the weekly hours for this developer.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>
              Bio <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <textarea
              className={textareaClass}
              placeholder="Short bio..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Skills <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <TechStackPicker value={techStack} onChange={setTechStack} />
          </div>

          <DialogFooterActions
            onCancel={onClose}
            onSubmit={handleSubmit}
            submitDisabled={false}
            pending={mutation.isPending}
            submitLabel="Save Changes"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
