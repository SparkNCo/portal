import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_HEADERS } from "@/lib/api-headers";

// Shared between the Roadmap page (app/[slug]/(portal)/monitor/page.tsx) and
// the pinned "roadmap_timeline" panel (components/dashboard/pinned-panel-renderer.tsx)
// — both need the exact same fetch/paginate/derive logic for RoadmapTimeline's
// props, so it lives here once instead of being duplicated in both places.
export function useRoadmapData(slug: string) {
  const {
    data: roadmap,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["roadmap", slug],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/roadmap/?slug=${encodeURIComponent(slug)}`,
        { headers: API_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to fetch roadmap");
      return res.json();
    },
    enabled: Boolean(slug),
  });

  const [projectNodes, setProjectNodes] = useState<any[]>([]);
  const [projectsCursor, setProjectsCursor] = useState<string | null>(null);
  const [hasMoreProjects, setHasMoreProjects] = useState(false);
  const [loadingMoreProjects, setLoadingMoreProjects] = useState(false);

  useEffect(() => {
    if (!roadmap?.initiative?.projects) return;

    setProjectNodes(roadmap.initiative.projects.nodes ?? []);
    setProjectsCursor(roadmap.initiative.projects.pageInfo?.endCursor ?? null);
    setHasMoreProjects(roadmap.initiative.projects.pageInfo?.hasNextPage ?? false);
  }, [roadmap]);

  async function handleLoadMoreProjects() {
    if (!slug || !projectsCursor || loadingMoreProjects) return;
    setLoadingMoreProjects(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/roadmap/?slug=${encodeURIComponent(slug)}&projectsAfter=${encodeURIComponent(projectsCursor)}`,
        { headers: API_HEADERS },
      );
      if (!res.ok) throw new Error("Failed to load more projects");
      const data = await res.json();
      const nextProjects = data?.initiative?.projects;
      setProjectNodes((prev) => [...prev, ...(nextProjects?.nodes ?? [])]);
      setProjectsCursor(nextProjects?.pageInfo?.endCursor ?? null);
      setHasMoreProjects(nextProjects?.pageInfo?.hasNextPage ?? false);
    } catch (err) {
      console.error("Failed to load more projects:", err);
    } finally {
      setLoadingMoreProjects(false);
    }
  }

  const derived = useMemo(() => {
    const milestones = projectNodes.flatMap((project: any) =>
      (project.projectMilestones?.nodes ?? []).map((milestone: any) => ({
        ...milestone,
        projectName: project.name,
      })),
    );
    const projectNames = projectNodes.map((project: any) => project.name);
    const projectIdsByName: Record<string, string> = Object.fromEntries(
      projectNodes.map((project: any) => [project.name, project.id]),
    );
    const projectColorByName: Record<string, string> = Object.fromEntries(
      projectNodes
        .filter((project: any) => project.status?.color)
        .map((project: any) => [project.name, project.status.color]),
    );
    const cycles = roadmap?.cycles?.nodes ?? [];
    return { milestones, projectNames, projectIdsByName, projectColorByName, cycles };
  }, [projectNodes, roadmap]);

  return {
    ...derived,
    isLoading,
    error,
    hasMoreProjects,
    loadingMoreProjects,
    onLoadMoreProjects: handleLoadMoreProjects,
  };
}
