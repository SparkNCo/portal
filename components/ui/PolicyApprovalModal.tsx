"use client";

import { SparkButton } from "@/components/ui/spark-button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_JSON_HEADERS } from "@/lib/api-headers";
import { toast } from "sonner";

interface PolicyApprovalModalProps {
  open: boolean;
  userId: string;
  notionUrl: string;
  onApproved?: () => void;
}

export function PolicyApprovalModal({
  open,
  userId,
  notionUrl,
  onApproved,
}: PolicyApprovalModalProps) {
  const queryClient = useQueryClient();

  // 🔹 Mutation to approve policies
  const { mutate: approvePolicies, isPending: loading } = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/agreePolicies/approve`,
        {
          method: "POST",
          headers: API_JSON_HEADERS,
          body: JSON.stringify({ userId, notionUrl }),
        },
      );
      if (!res.ok) throw new Error("Failed to approve policies");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies-status", userId] });
      onApproved?.();
    },
    onError: () => toast.error("Failed to approve policies. Please try again."),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg p-6 max-w-md w-full shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Developer Policies</h2>
        <p className="mb-4">
          Please review and agree to the policies before continuing:
        </p>
        <SparkButton
          variant="inverted"
          className="w-full mb-6"
          onClick={() =>
            window.open(notionUrl, "_blank", "noopener,noreferrer")
          }
        >
          View Policies
        </SparkButton>
        <div className="flex justify-end">
          <SparkButton
            variant="primary"
            className="w-full"
            onClick={() => approvePolicies()}
            disabled={loading}
          >
            {loading ? "Approving..." : "I Agree"}
          </SparkButton>
        </div>
      </div>
    </div>
  );
}
