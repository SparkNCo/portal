"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/components/ui/button";
import { CalendarDays, Briefcase, Pencil } from "lucide-react";

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
  return (
    <Dialog open={!!developer} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="w-[95vw] sm:w-full sm:max-w-md max-h-[85vh] overflow-y-auto"
        aria-describedby={undefined}
      >
        {developer && (
          <>
            <DialogHeader>
              <div className="flex flex-col gap-3 pr-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold text-primary ring-2 ring-primary/20">
                    {developer.avatar}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <DialogTitle className="truncate">{developer.name}</DialogTitle>
                    {developer.email && (
                      <p className="text-xs text-muted-foreground truncate">
                        {developer.email}
                      </p>
                    )}
                    {developer.role && (
                      <Badge
                        variant="outline"
                        className="border-primary/30 bg-primary/5 text-primary capitalize"
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
                    className="gap-1 self-start sm:shrink-0"
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
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>
                    Added {new Date(developer.joined).toLocaleDateString()}
                  </span>
                </div>
              )}

              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                  <Briefcase className="h-3.5 w-3.5" />
                  Bio
                </p>
                <div className="rounded-lg bg-muted/40 p-3">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {developer.bio || "No bio provided yet."}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Tech Stack
                </p>
                {developer.techStack.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {developer.techStack.map((tech) => (
                      <Badge
                        key={tech}
                        variant="outline"
                        className="border-border bg-muted/40 text-foreground"
                      >
                        {tech}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No tech stack listed yet.
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
