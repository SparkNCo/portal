"use client";

import { useQuery } from "@tanstack/react-query";
import { API_HEADERS } from "@/lib/api-headers";
import { MyHoursModal } from "@/components/developer/my-hours-modal";
import { fetchIssues } from "@/app/[slug]/(portal)/dashboard/page";

// Admin → Users: a developer's submitted hours, read-only. The same view the
// developer has ("My Logged Hours": chart, project and date filters, weekly
// allocation, each day's entries), fed with that developer's assignments.

type DeveloperAssignment = {
  id: string;
  role: string;
  allocation: number | null;
  clientName: string | null;
  linear_slug: string | null;
};

async function fetchDeveloperAssignments(developerId: string): Promise<DeveloperAssignment[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/assignments?developer=${encodeURIComponent(developerId)}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) throw new Error("Failed to load the developer's projects");
  return res.json();
}

export default function DeveloperHoursModal({
  developerId,
  developerEmail,
  developerName,
  onClose,
}: Readonly<{
  developerId: string;
  developerEmail: string;
  developerName?: string;
  onClose: () => void;
}>) {
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["developer-assignments", developerId],
    queryFn: () => fetchDeveloperAssignments(developerId),
  });

  // Same shape the developer's own page builds (clientName, slug, weekly
  // allocation), developer assignments only.
  const projects = assignments
    .filter((a) => a.role === "developer" && a.clientName)
    .map((a) => ({
      clientName: a.clientName as string,
      slug: a.linear_slug ?? (a.clientName as string),
      allocation: a.allocation ?? null,
    }));

  // Their projects' tickets, only to show codes (SPA-123) on the entries
  // instead of raw ids. Closed ones included: hours are often logged on
  // tickets that are done by now.
  const { data: issues = [] } = useQuery({
    queryKey: ["developer-hours-issues", projects.map((p) => p.clientName)],
    queryFn: async () => (await Promise.all(projects.map((p) => fetchIssues(p.clientName)))).flat(),
    enabled: projects.length > 0,
  });

  return (
    <MyHoursModal
      projects={projects}
      issues={issues}
      developerId={developerId}
      developerEmail={developerEmail}
      onClose={onClose}
      readOnly
      // Until their projects are in, the filter and allocation would be empty.
      loading={assignmentsLoading}
      title={`Logged Hours — ${developerName || developerEmail}`}
    />
  );
}
