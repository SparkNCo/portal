"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { isValidPhone } from "@/lib/phone";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus } from "lucide-react";

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
              <DialogTitle className="truncate text-primary">Add Developer</DialogTitle>
              <p className="smalltext text-muted-foreground">
                Create a developer account and invite them to the portal.
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
            <Label htmlFor="dev-github-handle" className="smalltext">
              Github Handle{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="dev-github-handle"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="smalltext bg-secondary border-0"
              placeholder="e.g. janedoe"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dev-email" className="smalltext">Email</Label>
            <Input
              id="dev-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="smalltext bg-secondary border-0"
              placeholder="developer@company.com"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
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
                  { value: "internal", label: "External" },
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
              Spark & Co FDE developers are billed through the customer's subscription. External developers are not billed to customers — set their rate below.
            </p>
          </div>

          {isInternal && (
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="dev-rate-amount" className="smalltext">Rate Amount</Label>
                <Input
                  id="dev-rate-amount"
                  type="text"
                  inputMode="decimal"
                  className="smalltext bg-secondary border-0"
                  placeholder="e.g. 150"
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
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="dev-rate-type" className="smalltext">Rate Type</Label>
                <Select
                  value={rateType}
                  onValueChange={(value) => setRateType(value as "hourly" | "monthly" | "annual")}
                >
                  <SelectTrigger id="dev-rate-type" className="smalltext bg-secondary border-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {isInternal && submitted && !isRateValid && (
            <p className="smalltext text-red-400">Enter a rate amount greater than 0.</p>
          )}

          <ModalError error={error} />

          <ModalFooter
            onCancel={onClose}
            onSubmit={handleSubmit}
            disabled={isPending || !email}
            pending={isPending}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
