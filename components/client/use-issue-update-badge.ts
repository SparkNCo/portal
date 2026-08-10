"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";
import { useUser } from "context/UserContext";
import type { Issue } from "./issues.types";

// portal.issue_updates holds the latest change per issue (who/when). Each
// user's own read state lives separately in portal.issue_views (issue_id,
// user_id, viewed_at), so a badge is "unseen" for a given user when their
// view row is missing or older than the issue's last update — independent
// of whether any other member has already opened the issue.
export function useIssueUpdateBadge() {
  const { profile } = useUser();

  const { data: updates } = useQuery({
    queryKey: ["issue-updates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("portal")
        .from("issue_updates")
        .select("issue_id, updated_by, updated_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: views } = useQuery({
    queryKey: ["issue-views", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("portal")
        .from("issue_views")
        .select("issue_id, viewed_at")
        .eq("user_id", profile!.id);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  return useMemo(() => {
    const updateByIssueId = new Map(
      (updates ?? []).map((r) => [
        r.issue_id,
        { updatedBy: r.updated_by as string | null, updatedAt: r.updated_at as string },
      ]),
    );
    const viewedAtByIssueId = new Map(
      (views ?? []).map((r) => [r.issue_id, r.viewed_at as string]),
    );

    function hasUnseenUpdate(issue: Issue, currentUserEmail?: string) {
      const update = updateByIssueId.get(issue.id);
      if (!update || update.updatedBy === currentUserEmail) return false;
      const viewedAt = viewedAtByIssueId.get(issue.id);
      return !viewedAt || viewedAt < update.updatedAt;
    }
    function isOwnUnseenUpdate(issue: Issue, currentUserEmail?: string) {
      const update = updateByIssueId.get(issue.id);
      return !!update && update.updatedBy === currentUserEmail;
    }
    return { hasUnseenUpdate, isOwnUnseenUpdate };
  }, [updates, views]);
}
