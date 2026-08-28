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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NameFields,
  PhoneField,
  ModalError,
  ModalFooter,
} from "@/components/shared/add-user-modal-fields";
import { UserPlus } from "lucide-react";

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

  const handleSubmit = () => {
    setSubmitted(true);
    if (isFormValid) mutate();
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
              <DialogTitle className="truncate text-primary">Add Stakeholder</DialogTitle>
              <p className="smalltext text-muted-foreground">
                Create a stakeholder account and assign them to an initiative.
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
            <Label htmlFor="stakeholder-username" className="smalltext">
              Username{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="stakeholder-username"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="smalltext bg-secondary border-0"
              placeholder="e.g. janedoe"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stakeholder-email" className="smalltext">Email</Label>
            <Input
              id="stakeholder-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="smalltext bg-secondary border-0"
              placeholder="stakeholder@company.com"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <PhoneField
            value={phoneNumber}
            onChange={setPhoneNumber}
            showError={submitted && !isPhoneValid}
          />

          <div className="space-y-1.5">
            <Label htmlFor="stakeholder-initiative" className="smalltext">Initiative</Label>
            <Select value={selectedCustomer || undefined} onValueChange={setSelectedCustomer}>
              <SelectTrigger id="stakeholder-initiative" className="smalltext bg-secondary border-0">
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
              <p className="smalltext text-red-400">Select an initiative to assign this stakeholder to.</p>
            )}
          </div>

          <ModalError error={error} />

          <ModalFooter
            onCancel={onClose}
            onSubmit={handleSubmit}
            disabled={isPending || !isFormValid}
            pending={isPending}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
