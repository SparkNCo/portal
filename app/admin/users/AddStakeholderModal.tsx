"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isValidPhone } from "@/lib/phone";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ModalShell,
  NameFields,
  PhoneField,
  ModalError,
  ModalFooter,
} from "@/components/shared/add-user-modal-fields";

type Customer = {
  id: string;
  email: string;
  clientName?: string;
};

type Props = {
  customers: Customer[];
  onClose: () => void;
};

export default function AddStakeholderModal({ customers, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userName, setUserName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
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

      const user = await res.json();

      const assignRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({
            user_id: user.id,
            customer_id: selectedCustomer,
            role: "stakeholder",
          }),
        },
      );

      if (!assignRes.ok) {
        throw new Error(
          "Stakeholder was created but couldn't be assigned to the initiative. Contact support.",
        );
      }

      return user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["all-assignments"] });
      onClose();
    },
  });

  const isFormValid = email && selectedCustomer && isPhoneValid;

  return (
    <ModalShell title="Add Stakeholder" widthClassName="w-[28rem]">
      <NameFields
        firstName={firstName}
        onFirstNameChange={setFirstName}
        lastName={lastName}
        onLastNameChange={setLastName}
      />
      <div className="space-y-1.5">
        <Label>
          Username{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          className="bg-secondary border-0"
          placeholder="e.g. janedoe"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-secondary border-0"
          placeholder="stakeholder@company.com"
          onKeyDown={(e) => e.key === "Enter" && isFormValid && !isPending && mutate()}
        />
      </div>
      <PhoneField
        value={phoneNumber}
        onChange={setPhoneNumber}
        showError={submitted && !isPhoneValid}
      />

      <div className="space-y-1.5">
        <Label>Initiative</Label>
        <Select value={selectedCustomer || undefined} onValueChange={setSelectedCustomer}>
          <SelectTrigger className="bg-secondary border-0">
            <SelectValue placeholder="Select an initiative" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.clientName ?? c.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {submitted && !selectedCustomer && (
          <p className="smalltext text-destructive">Select an initiative to assign this stakeholder to.</p>
        )}
      </div>

      <ModalError error={error} />

      <ModalFooter
        onCancel={onClose}
        onSubmit={() => {
          setSubmitted(true);
          if (isFormValid) mutate();
        }}
        disabled={isPending || !isFormValid}
        pending={isPending}
      />
    </ModalShell>
  );
}
