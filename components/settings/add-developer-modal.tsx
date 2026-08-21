"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { isValidPhone } from "@/lib/phone";
import { PhoneField } from "@/components/shared/add-user-modal-fields";
import { TechStackPicker } from "@/components/shared/tech-stack-picker";
import { DialogFooterActions } from "@/components/shared/dialog-footer-actions";

type DeveloperKind = "internal" | "spark_fde";

const textareaClass =
  "w-full rounded-md border-0 bg-secondary p-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px] resize-none";

async function createInternalDeveloper(payload: {
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  bio?: string;
  techStack: string[];
  allocation: number;
  customerId: string;
}) {
  const createRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=developer`,
    {
      method: "POST",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({
        email: payload.email,
        role: "developer",
        origin: globalThis.location.origin,
        developerType: "internal",
        ...(payload.firstName && { firstName: payload.firstName }),
        ...(payload.lastName && { lastName: payload.lastName }),
        ...(payload.phoneNumber && { phoneNumber: payload.phoneNumber }),
      }),
    },
  );
  if (!createRes.ok) {
    const body = await createRes.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to create developer");
  }
  const user = await createRes.json();

  if (payload.bio || payload.techStack.length > 0) {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=developer-profile`, {
      method: "PATCH",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({
        userId: user.id,
        bio: payload.bio || null,
        tech_stack: payload.techStack,
      }),
    });
  }

  const assignRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify({
      user_id: user.id,
      customer_id: payload.customerId,
      role: "developer",
      allocation: payload.allocation,
    }),
  });
  if (!assignRes.ok) {
    throw new Error("Developer was created but couldn't be added to your team. Contact support.");
  }

  return user;
}

async function requestFdeDeveloper(payload: {
  role: string;
  allocation?: number;
  notes?: string;
  requestedBy?: string;
  clientName?: string;
}) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/developer-requests`, {
    method: "POST",
    headers: API_JSON_HEADERS,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to send request");
  return res.json();
}

export function AddDeveloperModal({
  customerId,
  clientName,
  requestedBy,
}: {
  readonly customerId: string;
  readonly clientName?: string;
  readonly requestedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<DeveloperKind>("spark_fde");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bio, setBio] = useState("");
  const [techStack, setTechStack] = useState<string[]>([]);
  const [allocation, setAllocation] = useState("");

  const [role, setRole] = useState("");
  const [fdeAllocation, setFdeAllocation] = useState("");
  const [notes, setNotes] = useState("");

  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const isPhoneValid = isValidPhone(phoneNumber);
  const isInternal = kind === "internal";
  const isAllocationValid = allocation.trim() !== "" && Number(allocation) > 0;

  const internalMutation = useMutation({
    mutationFn: () =>
      createInternalDeveloper({
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phoneNumber: phoneNumber || undefined,
        bio: bio || undefined,
        techStack,
        allocation: Number(allocation),
        customerId,
      }),
    onSuccess: () => {
      toast.success("Developer added to your team");
      queryClient.invalidateQueries({ queryKey: ["assignments", customerId] });
      handleClose();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add developer"),
  });

  const fdeMutation = useMutation({
    mutationFn: () =>
      requestFdeDeveloper({
        role,
        allocation: fdeAllocation ? Number(fdeAllocation) : undefined,
        notes: notes || undefined,
        requestedBy,
        clientName,
      }),
    onSuccess: () => {
      toast.success("Request sent — our team will follow up shortly");
      handleClose();
    },
    onError: () => toast.error("Failed to send request. Please try again."),
  });

  const pending = internalMutation.isPending || fdeMutation.isPending;

  function handleClose() {
    setOpen(false);
    setSubmitted(false);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhoneNumber("");
    setBio("");
    setTechStack([]);
    setAllocation("");
    setRole("");
    setFdeAllocation("");
    setNotes("");
    setKind("spark_fde");
  }

  function handleSubmit() {
    setSubmitted(true);
    if (isInternal) {
      if (!email || !isPhoneValid || !isAllocationValid || pending) return;
      internalMutation.mutate();
    } else {
      if (!role.trim() || pending) return;
      fdeMutation.mutate();
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Add Developer
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent
          className="w-[95vw] sm:w-full sm:max-w-lg max-h-[85vh] overflow-y-auto"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>Add Developer</DialogTitle>
          </DialogHeader>

          <div className="flex gap-1 p-1 rounded-lg bg-secondary/40 border border-border">
            {(
              [
                { value: "spark_fde", label: "Spark & Co FDE" },
                { value: "internal", label: "Internal" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setKind(option.value)}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  kind === option.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {isInternal ? (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Add one of your own engineers to this initiative. They&apos;ll get an invite
                email to set up portal access.
              </p>

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
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-secondary border-0"
                  placeholder="developer@company.com"
                />
                {submitted && !email && (
                  <p className="text-sm text-destructive">Email is required.</p>
                )}
              </div>

              <PhoneField
                value={phoneNumber}
                onChange={setPhoneNumber}
                showError={submitted && !isPhoneValid}
              />

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
                  Skills{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <TechStackPicker value={techStack} onChange={setTechStack} />
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Request a Spark & Co full-time developer for this initiative. Our team will
                follow up and assign someone.
              </p>

              <div className="space-y-1.5">
                <Label>Role Needed</Label>
                <Input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="bg-secondary border-0"
                  placeholder="e.g. Backend Developer"
                />
                {submitted && !role.trim() && (
                  <p className="text-sm text-destructive">Tell us what role you need.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>
                  Weekly Allocation (Hours){" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={fdeAllocation}
                  onChange={(e) => setFdeAllocation(e.target.value)}
                  className="bg-secondary border-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  placeholder="e.g. 20"
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Notes <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <textarea
                  className={textareaClass}
                  placeholder="Anything else we should know?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooterActions
            onCancel={handleClose}
            onSubmit={handleSubmit}
            submitDisabled={false}
            pending={pending}
            submitLabel={isInternal ? "Add Developer" : "Send Request"}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
