"use client";

import { useState } from "react";
import { Button } from "@/components/components/ui/button";
import { useMutation } from "@tanstack/react-query";

export function useShareDocument() {
  return useMutation({
    mutationFn: async ({
      document_id,
      emails,
      user_id,
    }: {
      document_id: number;
      emails: string[];
      user_id: string | undefined;
    }) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_ENDPOINT}/storage/share`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            document_id,
            emails,
            user_id,
          }),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to share document");
      }

      return res.json();
    },
  });
}

export function ShareDocumentModal({
  isOpen,
  onClose,
  document,
  id,
}: {
  isOpen: boolean;
  onClose: () => void;
  document: any;
  id: string | undefined;
}) {
  const [emails, setEmails] = useState("");
  const shareMutation = useShareDocument();

  if (!isOpen) return null;

  const handleShare = () => {
    const emailArray = emails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    shareMutation.mutate(
      {
        document_id: document.id,
        emails: emailArray,
        user_id: id,
      },
      {
        onSuccess: () => {
          setEmails("");
          onClose();
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-background p-4 rounded-lg w-96 space-y-3">
        <h2 className="text-sm font-semibold">Share Document</h2>

        <p className="text-xs text-muted-foreground">
          Enter emails separated by commas
        </p>

        <input
          className="w-full border rounded px-2 py-1 text-sm"
          placeholder="example@mail.com, another@mail.com"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
        />

        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setEmails("");
              onClose();
            }}
          >
            Cancel
          </Button>

          <Button onClick={handleShare} disabled={shareMutation.isPending}>
            {shareMutation.isPending ? "Sharing..." : "Share"}
          </Button>
        </div>
      </div>
    </div>
  );
}
