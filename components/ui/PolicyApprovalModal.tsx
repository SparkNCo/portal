"use client";

import { useState } from "react";
import { SparkButton } from "@/components/ui/spark-button";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  // 🔹 Mutation to approve policies
  const { mutate: approvePolicies } = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/agreePolicies/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        },
      );
      if (!res.ok) throw new Error("Failed to approve policies");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["policies-status", userId]);
      onApproved?.();
    },
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
          onClick={() => window.open(notionUrl, "_blank", "noopener,noreferrer")}
        >
          View Policies
        </SparkButton>
        <div className="flex justify-end">
          <SparkButton
            variant="primary"
            className="w-full"
            onClick={() => {
              setLoading(true);
              approvePolicies();
            }}
            disabled={loading}
          >
            {loading ? "Approving..." : "I Agree"}
          </SparkButton>
        </div>
      </div>
    </div>
  );
}
