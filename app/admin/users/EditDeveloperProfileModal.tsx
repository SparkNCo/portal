"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { TechStackPicker } from "@/components/shared/tech-stack-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/components/ui/button";
import { Briefcase, Sparkles } from "lucide-react";

type Props = {
  userId: string;
  userEmail: string;
  userName?: string;
  role?: string;
  onClose: () => void;
};

export default function EditDeveloperProfileModal({
  userId,
  userEmail,
  userName,
  role,
  onClose,
}: Props) {
  const [bio, setBio] = useState("");
  const [techStack, setTechStack] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["developer-profile", userId],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=developer-profile&userId=${userId}`,
        { headers: API_JSON_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to load developer profile");
      return res.json();
    },
  });

  useEffect(() => {
    if (data) {
      setBio(data.bio ?? "");
      setTechStack(Array.isArray(data.tech_stack) ? data.tech_stack : []);
    }
  }, [data]);

  const { mutate, isPending, error } = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/users?type=developer-profile`,
        {
          method: "PATCH",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({ userId, bio: bio || null, tech_stack: techStack }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update developer profile");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["developer-profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      onClose();
    },
  });

  const name = userName || userEmail;
  const avatar = userEmail.slice(0, 2).toUpperCase();

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
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary ring-2 ring-primary/30">
              {avatar}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <DialogTitle className="truncate text-primary">{name}</DialogTitle>
              <p className="smalltext text-muted-foreground truncate">{userEmail}</p>
              {role && (
                <Badge
                  variant="outline"
                  className="smalltext border-primary/30 bg-primary/10 text-primary capitalize"
                >
                  {role}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-4 mt-1 border-t border-border">
          {isLoading ? (
            <p className="smalltext text-muted-foreground">Loading...</p>
          ) : (
            <>
              <div>
                <p className="flex items-center gap-1.5 smalltext font-medium text-foreground mb-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-primary" />
                  Bio
                </p>
                <textarea
                  className="w-full rounded-lg border-0 bg-muted/40 p-3 smalltext text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px] resize-none"
                  placeholder="Short bio..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>

              <div>
                <p className="flex items-center gap-1.5 smalltext font-medium text-foreground mb-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Skills
                </p>
                <TechStackPicker value={techStack} onChange={setTechStack} />
              </div>
            </>
          )}

          {error && (
            <p className="smalltext text-destructive">{(error as Error).message}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="smalltext" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="smalltext"
              disabled={isPending || isLoading}
              onClick={() => mutate()}
            >
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
