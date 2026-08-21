"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isValidPhone } from "@/lib/phone";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ModalShell,
  NameFields,
  PhoneField,
  ModalError,
  ModalFooter,
} from "@/components/shared/add-user-modal-fields";

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

  return (
    <ModalShell title="Add Customer" widthClassName="w-[28rem]">
      <NameFields
        firstName={firstName}
        onFirstNameChange={setFirstName}
        lastName={lastName}
        onLastNameChange={setLastName}
      />
      <div className="space-y-1.5">
        <Label>Client Name</Label>
        <Input
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          className="bg-secondary border-0"
          placeholder="e.g. Acme Inc"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-secondary border-0"
          placeholder="client@company.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Linear Slug</Label>
        <Input
          value={linearSlug}
          onChange={(e) => setLinearSlug(e.target.value)}
          className="bg-secondary border-0"
          placeholder="e.g. acme"
        />
      </div>
      <PhoneField
        value={phoneNumber}
        onChange={setPhoneNumber}
        showError={submitted && !isPhoneValid}
      />
      <div className="space-y-1.5">
        <Label>
          Stripe Customer ID{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          value={stripeId}
          onChange={(e) => setStripeId(e.target.value)}
          className="bg-secondary border-0"
          placeholder="cus_..."
        />
      </div>

      <ModalError error={error} />

      <ModalFooter
        onCancel={onClose}
        onSubmit={() => {
          setSubmitted(true);
          if (isPhoneValid) mutate();
        }}
        disabled={isPending || !email || !linearSlug || !userName}
        pending={isPending}
      />
    </ModalShell>
  );
}
