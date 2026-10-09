"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "context/UserContext";
import { useSelectedProject } from "@/lib/selected-project-context";
import { developerPanelPath, pickDeveloperProject } from "@/lib/developer-routes";

// Developer pages moved from /dev/{panel} to /{slug}/{panel}. Old links,
// bookmarks and notifications land here and are sent to the same page for
// the developer's selected initiative, keeping the query string (e.g. a
// notification's ?issueId=…&tab=…).
function Redirect({ panel }: { readonly panel: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useUser();
  const { selectedProject } = useSelectedProject();
  const hasProject = !!pickDeveloperProject(profile, selectedProject);

  useEffect(() => {
    if (!hasProject) return;
    const query = searchParams.toString();
    const path = developerPanelPath(profile, panel, selectedProject);
    router.replace(query ? `${path}?${query}` : path);
  }, [hasProject, profile, panel, selectedProject, searchParams, router]);

  if (hasProject) return null;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/40 p-10 text-center">
        <p className="smalltext font-medium text-foreground">No assigned projects yet</p>
        <p className="smalltext text-muted-foreground">
          Once you're assigned to a customer, their pages will show up here.
        </p>
      </div>
    </div>
  );
}

export function DevRouteRedirect({ panel }: { readonly panel: string }) {
  return (
    <Suspense fallback={null}>
      <Redirect panel={panel} />
    </Suspense>
  );
}
