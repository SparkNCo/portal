import { useMutation, useQueryClient } from "@tanstack/react-query";

export const CATEGORIES = ["Reports", "Technical", "Design"];

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, category }: { id: number; category: string }) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_ENDPOINT}/storage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, category }),
      });

      if (!res.ok) throw new Error("Failed to update document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
