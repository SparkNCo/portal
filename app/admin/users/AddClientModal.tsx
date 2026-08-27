"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isValidPhone } from "@/lib/phone";
import { API_JSON_HEADERS } from "@/lib/api-headers";
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
import { UserPlus } from "lucide-react";

type Props = {
  onClose: () => void;
};

export default function AddClientModal({ onClose }: Props) {
  const [email, setEmail] = useState("");
  const [stripeId, setStripeId] = useState("");
  const [linearSlug, setLinearSlug] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userName, setUserName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const isPhoneValid = isValidPhone(phoneNumber);

  const queryClient = useQueryClient();

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customer`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            email,
            linear_slug: linearSlug,
            clientName: userName,
            origin: globalThis.location.origin,
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(phoneNumber && { phoneNumber }),
            ...(stripeId.trim() && { customer_id: stripeId.trim() }),
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to create client");
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
    if (isPhoneValid) mutate();
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
              <UserPlus className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="truncate text-primary">Add Customer</DialogTitle>
              <p className="smalltext text-muted-foreground">
                Create a customer account and link it to their initiative.
              </p>
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
            <Label htmlFor="client-name" className="smalltext">Client Name</Label>
            <Input
              id="client-name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="smalltext bg-secondary border-0"
              placeholder="e.g. Acme Inc"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-email" className="smalltext">Email</Label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="smalltext bg-secondary border-0"
              placeholder="client@company.com"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-linear-slug" className="smalltext">Linear Slug</Label>
            <Input
              id="client-linear-slug"
              value={linearSlug}
              onChange={(e) => setLinearSlug(e.target.value)}
              className="smalltext bg-secondary border-0"
              placeholder="e.g. acme"
            />
          </div>
          <PhoneField
            value={phoneNumber}
            onChange={setPhoneNumber}
            showError={submitted && !isPhoneValid}
          />
          <div className="space-y-1.5">
            <Label htmlFor="client-stripe-id" className="smalltext">
              Stripe Customer ID{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="client-stripe-id"
              value={stripeId}
              onChange={(e) => setStripeId(e.target.value)}
              className="smalltext bg-secondary border-0"
              placeholder="cus_..."
            />
          </div>

          <ModalError error={error} />

          <ModalFooter
            onCancel={onClose}
            onSubmit={handleSubmit}
            disabled={isPending || !email || !linearSlug || !userName}
            pending={isPending}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
