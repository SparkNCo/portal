"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isValidPhone } from "@/lib/phone";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { supabase } from "@/lib/supabase-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/components/ui/button";
import { ExpandableDialogChrome } from "@/components/shared/expandable-dialog-chrome";
import {
  NameFields,
  PhoneField,
  ModalError,
  ModalFooter,
} from "@/components/shared/add-user-modal-fields";
import { Pencil, Plus, X, Link as LinkIcon } from "lucide-react";

type PreviewLink = { url: string; text: string };

type Props = {
  userId: string;
  customerId: string;
  userEmail: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  clientName?: string | null;
  linearSlug?: string | null;
  previewLinks: PreviewLink[];
  onClose: () => void;
};

// Plain "label / value" row for the read-only view — an em dash stands in
// for anything left blank, so the layout doesn't jump between view and edit
// mode depending on which fields happen to be filled in.
function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="smalltext font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground break-words">{value?.trim() || "—"}</p>
    </div>
  );
}

export default function EditClientModal({
  userId,
  customerId,
  userEmail,
  firstName: initialFirstName,
  lastName: initialLastName,
  phoneNumber: initialPhoneNumber,
  clientName: initialClientName,
  linearSlug: initialLinearSlug,
  previewLinks: initialPreviewLinks,
  onClose,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [email, setEmail] = useState(userEmail);
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? "");
  const [clientName, setClientName] = useState(initialClientName ?? "");
  const [linearSlug, setLinearSlug] = useState(initialLinearSlug ?? "");
  const [previewLinks, setPreviewLinks] = useState<PreviewLink[]>(
    initialPreviewLinks,
  );
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const isPhoneValid = isValidPhone(phoneNumber);

  // Discards any in-progress edits and drops back to the read-only view —
  // reset from the original props rather than just flipping `isEditing`, so
  // reopening Edit later doesn't resurrect an abandoned draft.
  function resetToViewMode() {
    setEmail(userEmail);
    setFirstName(initialFirstName ?? "");
    setLastName(initialLastName ?? "");
    setPhoneNumber(initialPhoneNumber ?? "");
    setClientName(initialClientName ?? "");
    setLinearSlug(initialLinearSlug ?? "");
    setPreviewLinks(initialPreviewLinks);
    setSubmitted(false);
    setIsEditing(false);
  }

  function addLink() {
    setPreviewLinks((prev) => [...prev, { text: "", url: "" }]);
  }

  function updateLink(index: number, field: keyof PreviewLink, value: string) {
    setPreviewLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
    );
  }

  function removeLink(index: number) {
    setPreviewLinks((prev) => prev.filter((_, i) => i !== index));
  }

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      // The backend resolves "am I actually an admin?" from this token (the
      // anon key in API_JSON_HEADERS isn't a real session) — Preview Links,
      // and changing someone else's login email, both require it.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const authHeaders = {
        ...API_JSON_HEADERS,
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      };

      // Blank preview-link rows the admin never filled in are just dropped
      // rather than blocking save — the backend also rejects a half-filled
      // row (only one of text/url set), so those still surface as an error.
      const cleanedLinks = previewLinks.filter(
        (l) => l.text.trim() || l.url.trim(),
      );

      const customerRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=customer`,
        {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({
            customer_id: customerId,
            clientName: clientName.trim(),
            linear_slug: linearSlug.trim(),
            preview_links: cleanedLinks,
          }),
        },
      );
      if (!customerRes.ok) {
        const body = await customerRes.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update customer");
      }

      const userRes = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users`,
        {
          method: "PATCH",
          headers: authHeaders,
          body: JSON.stringify({
            id: userId,
            email: email.trim(),
            firstName: firstName.trim() || null,
            lastName: lastName.trim() || null,
            phoneNumber: phoneNumber.trim() || null,
          }),
        },
      );
      if (!userRes.ok) {
        const body = await userRes.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update customer contact info");
      }

      return userRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onClose();
    },
  });

  const handleSubmit = () => {
    setSubmitted(true);
    if (isPhoneValid && email.trim() && clientName.trim() && linearSlug.trim()) {
      mutate();
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={`w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto overflow-x-hidden transition-all duration-200 ${
          isExpanded || isEditing
            ? "sm:max-w-2xl md:max-w-4xl lg:max-w-5xl"
            : "sm:max-w-lg"
        }`}
        aria-describedby={undefined}
      >
        <ExpandableDialogChrome
          isExpanded={isExpanded}
          onToggleExpanded={() => setIsExpanded((e) => !e)}
        />

        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="absolute right-10 top-4 lg:right-16 text-muted-foreground hover:text-primary transition-colors"
            aria-label="Edit customer"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}

        <DialogHeader className="pt-4">
          <div className="flex min-w-0 items-center gap-3.5 pr-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary ring-2 ring-primary/30">
              {userEmail.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="truncate text-primary">
                {initialClientName || userEmail}
              </DialogTitle>
              <p className="smalltext text-muted-foreground truncate">Customer Profile</p>
            </div>
          </div>
        </DialogHeader>

        {isEditing ? (
          <div className="space-y-4 pt-4 mt-1 border-t border-border">
            <NameFields
              firstName={firstName}
              onFirstNameChange={setFirstName}
              lastName={lastName}
              onLastNameChange={setLastName}
            />

            <div className="space-y-1.5">
              <Label htmlFor="edit-client-name" className="smalltext">Client Name</Label>
              <Input
                id="edit-client-name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="smalltext bg-secondary border-0"
                placeholder="e.g. Acme Inc"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-client-email" className="smalltext">Email</Label>
              <Input
                id="edit-client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="smalltext bg-secondary border-0"
                placeholder="client@company.com"
              />
            </div>

            <PhoneField
              value={phoneNumber}
              onChange={setPhoneNumber}
              showError={submitted && !isPhoneValid}
            />

            <div className="space-y-1.5">
              <Label htmlFor="edit-client-linear-slug" className="smalltext">Linear Slug</Label>
              <Input
                id="edit-client-linear-slug"
                value={linearSlug}
                onChange={(e) => setLinearSlug(e.target.value)}
                className="smalltext bg-secondary border-0"
                placeholder="e.g. acme"
              />
              {submitted && !linearSlug.trim() && (
                <p className="smalltext text-red-400">Linear Slug is required.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="smalltext flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5 text-primary" />
                  Preview Links
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 smalltext"
                  onClick={addLink}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Preview Link
                </Button>
              </div>
              <p className="smalltext text-muted-foreground">
                Shown at the top of every one of this customer's Demo tabs —
                e.g. a link to their test environment.
              </p>

              {previewLinks.length === 0 ? (
                <p className="smalltext text-muted-foreground italic">
                  No preview links yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {previewLinks.map((link, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-2.5"
                    >
                      <div className="flex-1 space-y-1.5">
                        <Input
                          value={link.text}
                          onChange={(e) => updateLink(i, "text", e.target.value)}
                          className="smalltext bg-secondary border-0"
                          placeholder="Description, e.g. Test Environment"
                        />
                        <Input
                          value={link.url}
                          onChange={(e) => updateLink(i, "url", e.target.value)}
                          className="smalltext bg-secondary border-0"
                          placeholder="https://..."
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLink(i)}
                        aria-label="Remove preview link"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <ModalError error={error} />

            <ModalFooter
              onCancel={resetToViewMode}
              onSubmit={handleSubmit}
              disabled={isPending}
              pending={isPending}
              submitLabel="Save"
              pendingLabel="Saving..."
            />
          </div>
        ) : (
          <div className="space-y-4 pt-4 mt-1 border-t border-border">
            <div className="grid grid-cols-2 gap-3">
              <ProfileField label="First Name" value={initialFirstName} />
              <ProfileField label="Last Name" value={initialLastName} />
            </div>
            <ProfileField label="Client Name" value={initialClientName} />
            <ProfileField label="Email" value={userEmail} />
            <ProfileField label="Phone Number" value={initialPhoneNumber} />
            <ProfileField label="Linear Slug" value={initialLinearSlug} />

            <div className="space-y-1.5">
              <p className="smalltext font-medium text-muted-foreground flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5 text-primary" />
                Preview Links
              </p>
              {initialPreviewLinks.length === 0 ? (
                <p className="text-sm text-foreground">—</p>
              ) : (
                <div className="space-y-1.5">
                  {initialPreviewLinks.map((link) => (
                    <a
                      key={`${link.url}-${link.text}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-primary hover:underline break-words"
                    >
                      {link.text}: {link.url}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
