"use client";

import { useQuery } from "@tanstack/react-query";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { DeveloperDetailsModal } from "@/components/settings/developer-details-modal";

type Props = {
  userId: string;
  userEmail: string;
  userName?: string;
  role: string;
  onClose: () => void;
  onEdit?: () => void;
};

export default function ViewDeveloperProfileModal({
  userId,
  userEmail,
  userName,
  role,
  onClose,
  onEdit,
}: Props) {
  const { data } = useQuery({
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

  return (
    <DeveloperDetailsModal
      developer={{
        name: userName || userEmail,
        email: userEmail,
        role,
        avatar: userEmail.slice(0, 2).toUpperCase(),
        bio: data?.bio ?? null,
        techStack: Array.isArray(data?.tech_stack) ? data.tech_stack : [],
      }}
      onClose={onClose}
      onEdit={onEdit}
    />
  );
}
