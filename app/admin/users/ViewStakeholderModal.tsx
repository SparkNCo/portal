"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/components/ui/button";
import { ExpandableDialogChrome } from "@/components/shared/expandable-dialog-chrome";
import { Pencil } from "lucide-react";

type Props = {
  userId: string;
  userEmail: string;
  firstName?: string | null;
  lastName?: string | null;
  userName?: string | null;
  phoneNumber?: string | null;
  onClose: () => void;
  onEdit?: () => void;
};

// Plain "label / value" row for the read-only view — an em dash stands in
// for anything left blank, same convention as EditClientModal's own
// ProfileField (Customer Profile's read-only view).
function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="smalltext font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground break-words">{value?.trim() || "—"}</p>
    </div>
  );
}

// Read-only counterpart to EditStakeholderModal — same "Profile" button
// developers already get (ViewDeveloperProfileModal → Edit), just without a
// bio/tech stack section since a stakeholder has neither.
export default function ViewStakeholderModal({
  userEmail,
  firstName,
  lastName,
  userName,
  phoneNumber,
  onClose,
  onEdit,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={`w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto overflow-x-hidden transition-all duration-200 ${
          isExpanded ? "sm:max-w-2xl md:max-w-4xl lg:max-w-5xl" : "sm:max-w-lg"
        }`}
        aria-describedby={undefined}
      >
        <ExpandableDialogChrome
          isExpanded={isExpanded}
          onToggleExpanded={() => setIsExpanded((e) => !e)}
        />

        <DialogHeader className="pt-4">
          <div className="flex flex-col gap-3 pr-12 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary ring-2 ring-primary/30">
                {userEmail.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <DialogTitle className="truncate text-primary">
                  {userName || userEmail}
                </DialogTitle>
                <p className="smalltext text-muted-foreground truncate">Stakeholder Profile</p>
              </div>
            </div>
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 self-start sm:shrink-0 smalltext border-primary/30 text-primary hover:bg-background hover:text-primary"
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-4 mt-1 border-t border-border">
          <div className="grid grid-cols-2 gap-3">
            <ProfileField label="First Name" value={firstName} />
            <ProfileField label="Last Name" value={lastName} />
          </div>
          <ProfileField label="Username" value={userName} />
          <ProfileField label="Email" value={userEmail} />
          <ProfileField label="Phone Number" value={phoneNumber} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
