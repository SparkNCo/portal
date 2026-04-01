import { useMutation, useQueryClient } from "@tanstack/react-query";

export const CATEGORIES = ["Reports", "Technical", "Design"];

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      document_id,
      user_id,
    }: {
      document_id: number;
      user_id: string;
    }) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/storage`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id, user_id }),
      });

      if (!res.ok) throw new Error("Failed to delete document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      document_id,
      category,
      user_id,
    }: {
      document_id: number;
      category: string;
      user_id: string;
    }) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/storage`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id, category, user_id }),
      });

      if (!res.ok) throw new Error("Failed to update document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
