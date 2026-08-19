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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      console.log("hi");
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
    <ModalShell title="Add Developer" widthClassName="w-[28rem]">
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
        <p className="smalltext font-medium text-muted-foreground">Developer Type</p>
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
              className={`flex-1 px-3 py-1.5 rounded-md smalltext font-medium transition-all ${
                developerType === option.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="smalltext text-muted-foreground">
          Spark & Co FDE developers are billed through the customer's subscription. Internal developers are not billed to customers — set their rate below.
        </p>
      </div>

      {isInternal && (
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            className={`${inputClass} flex-1`}
            placeholder="Rate amount"
            value={rateAmount}
            onChange={(e) => {
              const value = e.target.value.replace(/[^0-9.]/g, "");
              const firstDot = value.indexOf(".");
              setRateAmount(
                firstDot === -1
                  ? value
                  : value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replaceAll(".", ""),
              );
            }}
          />
          <Select
            value={rateType}
            onValueChange={(value) => setRateType(value as "hourly" | "monthly" | "annual")}
          >
            <SelectTrigger className="flex-1 h-9 smalltext">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {isInternal && submitted && !isRateValid && (
        <p className="smalltext text-destructive">Enter a rate amount greater than 0.</p>
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
