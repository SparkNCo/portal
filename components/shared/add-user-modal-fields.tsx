import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/components/ui/button";
import { UserPlus } from "lucide-react";

export const inputClass =
  "w-full rounded border-2 border-transparent focus:border-primary focus:outline-none p-2 bg-secondary text-secondary-foreground smalltext";

export function ModalShell({
  title,
  children,
  widthClassName = "w-96",
}: {
  title: string;
  children: ReactNode;
  /** Override the default w-96 for modals that need more room (e.g. Add Developer). */
  widthClassName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className={`${widthClassName} bg-background border-border shadow-lg text-foreground`}>
        <CardHeader>
          <CardTitle className="body font-semibold flex items-center gap-2 text-primary">
            <UserPlus className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </div>
  );
}

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
      <input
        className={inputClass}
        placeholder="First name (optional)"
        value={firstName}
        onChange={(e) => onFirstNameChange(e.target.value)}
      />
      <input
        className={inputClass}
        placeholder="Last name (optional)"
        value={lastName}
        onChange={(e) => onLastNameChange(e.target.value)}
      />
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
  showError: boolean;
}) {
  return (
    <>
      <input
        className={inputClass}
        placeholder="Phone number (optional)"
        value={value}
        onChange={(e) => onChange(e.target.value.replaceAll(/[^0-9+\-() ]/g, ""))}
      />
      {showError && (
        <p className="smalltext text-destructive">Enter a valid phone number.</p>
      )}
    </>
  );
}

export function ModalError({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="smalltext text-destructive">{(error as Error).message}</p>;
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
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" disabled={disabled} onClick={onSubmit}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </div>
  );
}
