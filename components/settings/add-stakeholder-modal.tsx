"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, UserPlus } from "lucide-react";
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
import {
  NameFields,
  PhoneField,
  ModalError,
  ModalFooter,
} from "@/components/shared/add-user-modal-fields";
import { ExpandableDialogChrome } from "@/components/shared/expandable-dialog-chrome";

// Best-effort only — mirrors developer-requests' "never fail the actual
// write over a notification hiccup" convention (see supabase/functions/lib/
// vector.ts's own comment on the same idea). Unlike a developer request,
// this never gates or blocks the creation itself: the stakeholder is already
// created and assigned by the time this fires, admins just get visibility.
async function notifyAdminsOfStakeholder(payload: {
  stakeholderEmail: string;
  stakeholderName?: string;
  clientName?: string;
  addedBy?: string;
}) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/stakeholder-notifications`, {
      method: "POST",
      headers: API_JSON_HEADERS,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[notifyAdminsOfStakeholder] failed (non-fatal):", err);
  }
}

// Self-service counterpart to app/admin/users/AddStakeholderModal.tsx — same
// create-then-assign flow, minus the "Initiative" picker: a client/
// stakeholder can only ever be adding someone to their own initiative, so
// `customerId` is a fixed prop instead of a dropdown.
async function createAndAssignStakeholder(payload: {
  email: string;
  firstName?: string;
  lastName?: string;
  userName?: string;
  phoneNumber?: string;
  customerId: string;
  clientName?: string;
  addedBy?: string;
}) {
  const createRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=stakeholder`,
    {
      method: "POST",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({
        email: payload.email,
        role: "stakeholder",
        origin: globalThis.location.origin,
        ...(payload.firstName && { firstName: payload.firstName }),
        ...(payload.lastName && { lastName: payload.lastName }),
        ...(payload.userName && { userName: payload.userName }),
        ...(payload.phoneNumber && { phoneNumber: payload.phoneNumber }),
      }),
    },
  );
  if (!createRes.ok) {
    const body = await createRes.json().catch(() => null);
    throw new Error(body?.error ?? "Failed to create stakeholder");
  }
  const user = await createRes.json();

  const assignRes = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments`,
    {
      method: "POST",
      headers: API_JSON_HEADERS,
      body: JSON.stringify({
        user_id: user.id,
        customer_id: payload.customerId,
        role: "stakeholder",
      }),
    },
  );
  if (!assignRes.ok) {
    throw new Error(
      "Stakeholder was created but couldn't be added to your initiative. Contact support.",
    );
  }

  const stakeholderName = payload.firstName
    ? `${payload.firstName} ${payload.lastName ?? ""}`.trim()
    : payload.userName;
  await notifyAdminsOfStakeholder({
    stakeholderEmail: payload.email,
    stakeholderName: stakeholderName || undefined,
    clientName: payload.clientName,
    addedBy: payload.addedBy,
  });

  return user;
}

export function AddStakeholderModal({
  customerId,
  clientName,
  requestedBy,
}: {
  readonly customerId: string;
  readonly clientName?: string;
  readonly requestedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const isPhoneValid = isValidPhone(phoneNumber);

  const mutation = useMutation({
    mutationFn: () =>
      createAndAssignStakeholder({
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        userName: userName || undefined,
        phoneNumber: phoneNumber || undefined,
        customerId,
        clientName,
        addedBy: requestedBy,
      }),
    onSuccess: () => {
      toast.success("Stakeholder added");
      queryClient.invalidateQueries({ queryKey: ["assignments", customerId] });
      handleClose();
    },
    onError: (err: Error) => toast.error(err.message || "Failed to add stakeholder"),
  });

  function handleClose() {
    setOpen(false);
    setIsExpanded(false);
    setSubmitted(false);
    setFirstName("");
    setLastName("");
    setUserName("");
    setEmail("");
    setPhoneNumber("");
  }

  function handleSubmit() {
    setSubmitted(true);
    if (!email.trim() || !isPhoneValid || mutation.isPending) return;
    mutation.mutate();
  }

  return (
    <>
      <Button size="sm" variant="outline" className="smalltext" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Add Stakeholder
      </Button>

      <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
        <DialogContent
          className={`w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto overflow-x-hidden transition-all duration-200 ${
            isExpanded ? "sm:max-w-2xl md:max-w-4xl lg:max-w-5xl" : "sm:max-w-lg"
          }`}
          aria-describedby={undefined}
        >
          <ExpandableDialogChrome
            isExpanded={isExpanded}
            onToggleExpanded={() => setIsExpanded((e) => !e)}
          />

          <DialogHeader className="pt-4">
            <div className="flex min-w-0 items-center gap-3.5 pr-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-2 ring-primary/30">
                <UserPlus className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <DialogTitle className="truncate text-primary">Add Stakeholder</DialogTitle>
                <p className="smalltext text-muted-foreground">
                  Invite a colleague to view and collaborate on this initiative.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-4 mt-1 border-t border-border">
            <p className="smalltext text-muted-foreground">
              They&apos;ll get an invite email to set up portal access.
            </p>

            <NameFields
              firstName={firstName}
              onFirstNameChange={setFirstName}
              lastName={lastName}
              onLastNameChange={setLastName}
            />

            <div className="space-y-1.5">
              <Label htmlFor="self-stakeholder-username" className="smalltext">
                Username{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="self-stakeholder-username"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="smalltext bg-secondary border-0"
                placeholder="e.g. janedoe"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="self-stakeholder-email" className="smalltext">Email</Label>
              <Input
                id="self-stakeholder-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="smalltext bg-secondary border-0"
                placeholder="colleague@company.com"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
              {submitted && !email.trim() && (
                <p className="smalltext text-red-400">Email is required.</p>
              )}
            </div>

            <PhoneField
              value={phoneNumber}
              onChange={setPhoneNumber}
              showError={submitted && !isPhoneValid}
            />

            <ModalError error={mutation.error} />

            <ModalFooter
              onCancel={handleClose}
              onSubmit={handleSubmit}
              disabled={mutation.isPending}
              pending={mutation.isPending}
              submitLabel="Add Stakeholder"
              pendingLabel="Adding..."
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
