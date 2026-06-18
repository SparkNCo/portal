"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";

export type DocumentRequest = {
  id: string;
  customer_slug: string;
  requested_by: string;
  title: string;
  description: string | null;
  project_id: string | null;
  project_name: string | null;
  status: "pending" | "done";
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
};

export function useDocumentRequests(customerSlug?: string) {
  return useQuery({
    queryKey: ["document-requests", customerSlug ?? "all"],
    queryFn: async () => {
      let query = supabase
        .schema("portal")
        .from("document_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (customerSlug) {
        query = query.eq("customer_slug", customerSlug);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DocumentRequest[];
    },
  });
}
