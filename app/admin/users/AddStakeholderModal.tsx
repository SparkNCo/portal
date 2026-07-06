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

export default function AddStakeholderModal({ onClose }: Props) {
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
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=stakeholder`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            email,
            role: "stakeholder",
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
        throw new Error(body?.error ?? "Failed to create stakeholder");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });

  return (
    <ModalShell title="Add Stakeholder">
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
        placeholder="Stakeholder email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && email && !isPending && mutate()}
      />
      <PhoneField
        value={phoneNumber}
        onChange={setPhoneNumber}
        showError={submitted && !isPhoneValid}
      />

      <ModalError error={error} />

      <ModalFooter
        onCancel={onClose}
        onSubmit={() => {
          setSubmitted(true);
          if (isPhoneValid) mutate();
        }}
        disabled={isPending || !email}
        pending={isPending}
      />
    </ModalShell>
  );
}
