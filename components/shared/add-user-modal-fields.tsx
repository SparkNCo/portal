import { Button } from "@/components/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  showError: boolean;
}) {
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
      {showError && (
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
