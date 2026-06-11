"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { UserPlus } from "lucide-react";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { isValidPhone } from "@/lib/phone";

const inputClass =
  "w-full rounded border-2 border-transparent focus:border-primary focus:outline-none p-2 bg-secondary text-foreground text-sm";

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
        `${process.env.NEXT_PUBLIC_ENDPOINT}/users?type=developer`,
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

      if (!res.ok) throw new Error("Failed to create developer");

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-96 bg-background border-border shadow-lg">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-accent" />
            Add Developer
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              className={inputClass}
              placeholder="First name (optional)"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Last name (optional)"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
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
            onKeyDown={(e) => e.key === "Enter" && email && !isPending && mutate()}
          />
          <input
            className={inputClass}
            placeholder="Phone number (optional)"
            value={phoneNumber}
            onChange={(e) =>
              setPhoneNumber(e.target.value.replaceAll(/[^0-9+\-() ]/g, ""))
            }
          />
          {submitted && !isPhoneValid && (
            <p className="text-sm text-destructive">
              Enter a valid phone number.
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive">{(error as Error).message}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isPending || !email}
              onClick={() => {
                setSubmitted(true);
                if (isPhoneValid) mutate();
              }}
            >
              {isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
