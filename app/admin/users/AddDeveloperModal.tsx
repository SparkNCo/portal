"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { isValidPhone } from "@/lib/phone";
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

export default function AddDeveloperModal({ onClose }: Props) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userName, setUserName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const isPhoneValid = isValidPhone(phoneNumber);

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=developer`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            email,
            role: "developer",
            origin: globalThis.location.origin,
            ...(firstName && { firstName }),
            ...(lastName && { lastName }),
            ...(userName && { userName }),
            ...(phoneNumber && { phoneNumber }),
          }),
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to create developer");
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
    if (email && isPhoneValid && !isPending) mutate();
  };

  return (
    <ModalShell title="Add Developer">
      <NameFields
        firstName={firstName}
        onFirstNameChange={setFirstName}
        lastName={lastName}
        onLastNameChange={setLastName}
      />
      <input
        className={inputClass}
        placeholder="Username (optional)"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
      />
      <input
        className={inputClass}
        placeholder="Developer email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
      />
      <PhoneField
        value={phoneNumber}
        onChange={setPhoneNumber}
        showError={submitted && !isPhoneValid}
      />

      <ModalError error={error} />

      <ModalFooter
        onCancel={onClose}
        onSubmit={handleSubmit}
        disabled={isPending || !email}
        pending={isPending}
      />
    </ModalShell>
  );
}
