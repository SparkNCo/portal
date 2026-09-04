"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isValidPhone } from "@/lib/phone";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { supabase } from "@/lib/supabase-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NameFields,
  PhoneField,
  ModalError,
  ModalFooter,
} from "@/components/shared/add-user-modal-fields";
import { Eye } from "lucide-react";

type Props = {
  userId: string;
  userEmail: string;
  firstName?: string | null;
  lastName?: string | null;
  userName?: string | null;
  phoneNumber?: string | null;
  onClose: () => void;
};

export default function EditStakeholderModal({
  userId,
  userEmail,
  firstName: initialFirstName,
  lastName: initialLastName,
  userName: initialUserName,
  phoneNumber: initialPhoneNumber,
  onClose,
}: Props) {
  const [email, setEmail] = useState(userEmail);
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");
  const [userName, setUserName] = useState(initialUserName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? "");
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const isPhoneValid = isValidPhone(phoneNumber);

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      // Changing someone else's login email needs the caller's real admin
      // session — the anon key in API_JSON_HEADERS isn't a real session, so
      // the backend can't tell an admin from an anonymous request with it.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users`,
        {
          method: "PATCH",
          headers: {
            ...API_JSON_HEADERS,
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({
            id: userId,
            email: email.trim(),
            firstName: firstName.trim() || null,
            lastName: lastName.trim() || null,
            userName: userName.trim() || null,
            phoneNumber: phoneNumber.trim() || null,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update stakeholder");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });

  const handleSubmit = () => {
    setSubmitted(true);
    if (isValidPhone(phoneNumber) && email.trim()) mutate();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="w-[95vw] sm:w-full sm:max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden"
        aria-describedby={undefined}
      >
        <div className="-mx-6 -mt-6 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

        <DialogHeader className="pt-4">
          <div className="flex min-w-0 items-center gap-3.5 pr-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-2 ring-primary/30">
              <Eye className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="truncate text-primary">
                {initialUserName || userEmail}
              </DialogTitle>
              <p className="smalltext text-muted-foreground truncate">Stakeholder Profile</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-4 mt-1 border-t border-border">
          <NameFields
            firstName={firstName}
            onFirstNameChange={setFirstName}
            lastName={lastName}
            onLastNameChange={setLastName}
          />
          <div className="space-y-1.5">
            <Label htmlFor="edit-stakeholder-username" className="smalltext">
              Username{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="edit-stakeholder-username"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="smalltext bg-secondary border-0"
              placeholder="e.g. janedoe"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-stakeholder-email" className="smalltext">Email</Label>
            <Input
              id="edit-stakeholder-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="smalltext bg-secondary border-0"
              placeholder="stakeholder@company.com"
            />
          </div>
          <PhoneField
            value={phoneNumber}
            onChange={setPhoneNumber}
            showError={submitted && !isPhoneValid}
          />

          <ModalError error={error} />

          <ModalFooter
            onCancel={onClose}
            onSubmit={handleSubmit}
            disabled={isPending}
            pending={isPending}
            submitLabel="Save"
            pendingLabel="Saving..."
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
