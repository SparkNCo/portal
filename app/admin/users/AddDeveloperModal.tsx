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

type DeveloperType = "spark_fde" | "internal";

export default function AddDeveloperModal({ onClose }: Props) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userName, setUserName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [developerType, setDeveloperType] = useState<DeveloperType>("spark_fde");
  const [rateAmount, setRateAmount] = useState("");
  const [rateType, setRateType] = useState<"hourly" | "monthly" | "annual">("hourly");
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const isPhoneValid = isValidPhone(phoneNumber);
  const isInternal = developerType === "internal";
  const isRateValid = !isInternal || (rateAmount.trim() !== "" && Number(rateAmount) > 0);

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
            developerType,
            ...(isInternal && { rateAmount: Number(rateAmount), rateType }),
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
    if (email && isPhoneValid && isRateValid && !isPending) mutate();
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

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Developer Type</p>
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
              onClick={() => setDeveloperType(option.value)}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                developerType === option.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Spark & Co FDE developers are billed through the customer's subscription. Internal developers are not billed to customers — set their rate below.
        </p>
      </div>

      {isInternal && (
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            step="0.01"
            className={`${inputClass} flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            placeholder="Rate amount"
            value={rateAmount}
            onChange={(e) => setRateAmount(e.target.value)}
          />
          <select
            className={inputClass}
            value={rateType}
            onChange={(e) => setRateType(e.target.value as "hourly" | "monthly" | "annual")}
          >
            <option value="hourly">Hourly</option>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
      )}
      {isInternal && submitted && !isRateValid && (
        <p className="text-sm text-destructive">Enter a rate amount greater than 0.</p>
      )}

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
