"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isValidPhone } from "@/lib/phone";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import {
  inputClass,
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
      <input
        className={inputClass}
        placeholder="Client name"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
      />
      <input
        className={inputClass}
        placeholder="Client email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className={inputClass}
        placeholder="Linear Slug"
        value={linearSlug}
        onChange={(e) => setLinearSlug(e.target.value)}
      />
      <PhoneField
        value={phoneNumber}
        onChange={setPhoneNumber}
        showError={submitted && !isPhoneValid}
      />
      <input
        className={inputClass}
        placeholder="Stripe Customer ID (optional)"
        value={stripeId}
        onChange={(e) => setStripeId(e.target.value)}
      />

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
