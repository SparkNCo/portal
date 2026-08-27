"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/components/ui/button";
import {
  CalendarDays,
  Briefcase,
  Sparkles,
  Pencil,
  Maximize2,
  Minimize2,
} from "lucide-react";

export type DeveloperDetails = {
  name: string;
  email: string;
  role: string;
  joined?: string;
  avatar: string;
  bio?: string | null;
  techStack: string[];
  userId?: string;
  assignmentId?: string;
  developerType?: "spark_fde" | "internal";
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  hours?: number;
};

export function DeveloperDetailsModal({
  developer,
  onClose,
  onEdit,
}: {
  readonly developer: DeveloperDetails | null;
  readonly onClose: () => void;
  readonly onEdit?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Dialog open={!!developer} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className={`w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto overflow-x-hidden transition-all duration-200 ${
          isExpanded
            ? "sm:max-w-2xl md:max-w-4xl lg:max-w-5xl"
            : "sm:max-w-lg"
        }`}
        aria-describedby={undefined}
      >
        {developer && (
          <>
            {/* Orange accent bar ties the modal back to the card it was opened from. */}
            <div className="-mx-6 -mt-6 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

            {/* Positioned to match DialogContent's own close button (absolute
                right-4 top-4) exactly, same as EditIssueModal / EditDeveloperProfileModal. */}
            <button
              type="button"
              onClick={() => setIsExpanded((e) => !e)}
              className="hidden lg:inline-flex absolute right-10 top-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={isExpanded ? "Shrink modal" : "Expand modal"}
              title={isExpanded ? "Shrink" : "Expand"}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>

            <DialogHeader className="pt-4">
              <div className="flex flex-col gap-3 pr-12 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary ring-2 ring-primary/30">
                    {developer.avatar}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <DialogTitle className="truncate text-primary">
                      {developer.name}
                    </DialogTitle>
                    {developer.email && (
                      <p className="smalltext text-muted-foreground truncate">
                        {developer.email}
                      </p>
                    )}
                    {developer.role && (
                      <Badge
                        variant="outline"
                        className="smalltext border-primary/30 bg-primary/10 text-primary capitalize"
                      >
                        {developer.role}
                      </Badge>
                    )}
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

            <div className="space-y-5 pt-4 mt-1 border-t border-border">
              {developer.joined && (
                <div className="flex items-center gap-1.5 smalltext text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  <span>
                    Added {new Date(developer.joined).toLocaleDateString()}
                  </span>
                </div>
              )}

              <div>
                <p className="flex items-center gap-1.5 smalltext font-medium text-foreground mb-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-primary" />
                  Bio
                </p>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="smalltext text-foreground whitespace-pre-wrap break-words">
                    {developer.bio?.trim() || "No bio provided yet."}
                  </p>
                </div>
              </div>

              <div>
                <p className="flex items-center gap-1.5 smalltext font-medium text-foreground mb-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Skills
                </p>
                {developer.techStack.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {developer.techStack.map((tech) => (
                      <Badge
                        key={tech}
                        variant="outline"
                        className="smalltext border-border bg-muted/40 text-foreground max-w-full break-words"
                      >
                        {tech}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="smalltext text-muted-foreground">
                    No skills listed yet.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
