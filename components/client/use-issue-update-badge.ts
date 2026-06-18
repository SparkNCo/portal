"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";
import type { Issue } from "./issues.types";

// Single per-issue "has unseen update" flag (portal.issue_updates). Not
// per-user: a developer's edit flips it to unseen for everyone, and the
// first person to open the issue afterward flips it back to seen.
export function useIssueUpdateBadge() {
  const { data: rows } = useQuery({
    queryKey: ["issue-updates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("portal")
        .from("issue_updates")
        .select("issue_id, seen")
        .eq("seen", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  return useMemo(() => {
    const unseenIds = new Set((rows ?? []).map((r) => r.issue_id));
    return function hasUnseenUpdate(issue: Issue) {
      return unseenIds.has(issue.id);
    };
  }, [rows]);
}
