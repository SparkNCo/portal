"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "context/UserContext";
import { useSelectedProject } from "@/lib/selected-project-context";

// Demos moved to /{slug}/demos (every role can see them now). Old links and
// bookmarks land here and are sent to the developer's selected initiative.
export default function DevDemosRedirect() {
  const router = useRouter();
  const { profile } = useUser();
  const { selectedProject } = useSelectedProject();
  const project = selectedProject ?? profile?.assignment_id?.[0]?.clientName ?? null;

  useEffect(() => {
    if (project) router.replace(`/${encodeURIComponent(project.toLowerCase())}/demos`);
  }, [project, router]);

  if (project) return null;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/40 p-10 text-center">
        <p className="smalltext font-medium text-foreground">No assigned projects yet</p>
        <p className="smalltext text-muted-foreground">
          Once you're assigned to a customer, their demos will show up here.
        </p>
      </div>
    </div>
  );
}
