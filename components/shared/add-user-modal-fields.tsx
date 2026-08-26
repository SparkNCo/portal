"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidPhone } from "@/lib/phone";

// How long to wait after the user stops typing before flagging an invalid
// phone number on its own — long enough that it never fires mid-keystroke
// (e.g. between typing the area code and the rest of the number).
const PHONE_VALIDATION_DEBOUNCE_MS = 3000;

export function NameFields({
  firstName,
  onFirstNameChange,
  lastName,
  onLastNameChange,
}: {
  firstName: string;
  onFirstNameChange: (value: string) => void;
  lastName: string;
  onLastNameChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-2">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="user-first-name" className="smalltext">
          First Name{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="user-first-name"
          value={firstName}
          onChange={(e) => onFirstNameChange(e.target.value)}
          className="smalltext bg-secondary border-0"
          placeholder="e.g. Jane"
        />
      </div>
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="user-last-name" className="smalltext">
          Last Name{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="user-last-name"
          value={lastName}
          onChange={(e) => onLastNameChange(e.target.value)}
          className="smalltext bg-secondary border-0"
          placeholder="e.g. Smith"
        />
      </div>
    </div>
  );
}

export function PhoneField({
  value,
  onChange,
  showError,
}: {
  value: string;
  onChange: (value: string) => void;
  // Forces the error on immediately (e.g. after a failed submit attempt) —
  // separate from the field's own debounced live check below, which only
  // ever fires after a pause in typing, never on submit.
  showError: boolean;
}) {
  const [debouncedInvalid, setDebouncedInvalid] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Empty is valid (phone is optional) — only debounce-flag a non-empty,
    // still-invalid value once the user pauses typing.
    if (isValidPhone(value)) {
      setDebouncedInvalid(false);
      return;
    }
    debounceRef.current = setTimeout(
      () => setDebouncedInvalid(true),
      PHONE_VALIDATION_DEBOUNCE_MS,
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const displayError = showError || debouncedInvalid;

  return (
    <div className="space-y-1.5">
      <Label htmlFor="user-phone-number" className="smalltext">
        Phone Number{" "}
        <span className="text-muted-foreground font-normal">(optional)</span>
      </Label>
      <Input
        id="user-phone-number"
        value={value}
        onChange={(e) => onChange(e.target.value.replaceAll(/[^0-9+\-() ]/g, ""))}
        className="smalltext bg-secondary border-0"
        placeholder="e.g. (555) 123-4567"
      />
      {displayError && (
        <p className="smalltext text-red-400">Enter a valid phone number.</p>
      )}
    </div>
  );
}

export function ModalError({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="smalltext text-red-400">{(error as Error).message}</p>;
}

export function ModalFooter({
  onCancel,
  onSubmit,
  disabled,
  pending,
  submitLabel = "Create",
  pendingLabel = "Creating...",
}: {
  onCancel: () => void;
  onSubmit: () => void;
  disabled: boolean;
  pending: boolean;
  submitLabel?: string;
  pendingLabel?: string;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" size="sm" className="smalltext" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" className="smalltext" disabled={disabled} onClick={onSubmit}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </div>
  );
}
