"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";
import type { Issue } from "./issues.types";

// Single per-issue "has unseen update" flag (portal.issue_updates). Not
// per-user: a developer's edit flips it to unseen for everyone, and the
// first person to open the issue afterward flips it back to seen — except
// the person who made the edit, who never sees the badge and never clears
// it for everyone else by opening the issue.
export function useIssueUpdateBadge() {
  const { data: rows } = useQuery({
    queryKey: ["issue-updates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("portal")
        .from("issue_updates")
        .select("issue_id, seen, updated_by")
        .eq("seen", false);
      if (error) throw error;
      return data ?? [];
    },
  });

  return useMemo(() => {
    const unseenByIssueId = new Map(
      (rows ?? []).map((r) => [r.issue_id, r.updated_by as string | null]),
    );
    function hasUnseenUpdate(issue: Issue, currentUserEmail?: string) {
      const updatedBy = unseenByIssueId.get(issue.id);
      return unseenByIssueId.has(issue.id) && updatedBy !== currentUserEmail;
    }
    function isOwnUnseenUpdate(issue: Issue, currentUserEmail?: string) {
      const updatedBy = unseenByIssueId.get(issue.id);
      return unseenByIssueId.has(issue.id) && updatedBy === currentUserEmail;
    }
    return { hasUnseenUpdate, isOwnUnseenUpdate };
  }, [rows]);
}
