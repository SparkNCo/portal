"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { TechStackPicker } from "@/components/shared/tech-stack-picker";
import { Label } from "@/components/ui/label";
import {
  ModalShell,
  ModalError,
  ModalFooter,
} from "@/components/shared/add-user-modal-fields";

type Props = {
  userId: string;
  userEmail: string;
  onClose: () => void;
};

export default function EditDeveloperProfileModal({ userId, userEmail, onClose }: Props) {
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

  return (
    <ModalShell title={`Edit Profile — ${userEmail}`}>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label>Bio</Label>
            <textarea
              className="w-full rounded-md border-0 bg-secondary p-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[80px] resize-none"
              placeholder="Short bio..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Skills</Label>
            <TechStackPicker value={techStack} onChange={setTechStack} />
          </div>
        </>
      )}

      <ModalError error={error} />

      <ModalFooter
        onCancel={onClose}
        onSubmit={() => mutate()}
        disabled={isPending || isLoading}
        pending={isPending}
        submitLabel="Save Changes"
        pendingLabel="Saving..."
      />
    </ModalShell>
  );
}
