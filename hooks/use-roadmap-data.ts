import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { API_HEADERS } from "@/lib/api-headers";

type ProjectGroup = "active" | "completed" | "upcoming";

// Each group is a separate call to the roadmap function, filtered by Linear
// project status, so each one gets its own 10-projects-per-page budget
// instead of finished/backlog projects eating into the active list's.
function useProjectGroup(slug: string, group: ProjectGroup) {
  const query = useInfiniteQuery({
    queryKey: ["roadmap", slug, group],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ slug, group });
      if (pageParam) params.set("projectsAfter", pageParam);
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/roadmap/?${params.toString()}`,
        { headers: API_HEADERS },
      );
      if (!res.ok) throw new Error(`Failed to fetch ${group} roadmap projects`);
      return res.json();
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: any) =>
      lastPage?.initiative?.projects?.pageInfo?.hasNextPage
        ? (lastPage.initiative.projects.pageInfo.endCursor ?? null)
        : null,
    enabled: Boolean(slug),
  });

  const pages = query.data?.pages;
  const projectNodes = useMemo(
    () =>
      (pages ?? []).flatMap(
        (page: any) => page?.initiative?.projects?.nodes ?? [],
      ),
    [pages],
  );

  return {
    projectNodes,
    // Cycles only come back on the first page of the active group.
    cycles: pages?.[0]?.cycles?.nodes ?? [],
    isLoading: query.isLoading,
    error: query.error,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
    },
  };
}

export type ProjectGroupPaging = {
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
};

function toPaging(
  group: ReturnType<typeof useProjectGroup>,
): ProjectGroupPaging {
  return {
    hasMore: group.hasMore,
    loadingMore: group.loadingMore,
    onLoadMore: group.loadMore,
  };
}

export function useRoadmapData(slug: string) {
  const active = useProjectGroup(slug, "active");
  const completed = useProjectGroup(slug, "completed");
  const upcoming = useProjectGroup(slug, "upcoming");

  const derived = useMemo(() => {
    const projectNodes = [
      ...active.projectNodes,
      ...completed.projectNodes,
      ...upcoming.projectNodes,
    ];
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
    const projectStatusByName: Record<string, string> = Object.fromEntries(
      projectNodes
        .filter((project: any) => project.status?.name)
        .map((project: any) => [project.name, project.status.name]),
    );
    const projectTargetDateByName: Record<string, string | null> =
      Object.fromEntries(
        projectNodes.map((project: any) => [
          project.name,
          project.targetDate ?? null,
        ]),
      );
    return {
      milestones,
      projectNames,
      projectIdsByName,
      projectColorByName,
      projectStatusByName,
      projectTargetDateByName,
      cycles: active.cycles,
    };
  }, [
    active.projectNodes,
    completed.projectNodes,
    upcoming.projectNodes,
    active.cycles,
  ]);

  return {
    ...derived,
    // The page waits on the active group (it carries the cycles); the
    // completed/upcoming dividers simply appear once their calls land, and a
    // failure there just leaves that divider out instead of erroring the page.
    isLoading: active.isLoading,
    error: active.error,
    hasMoreProjects: active.hasMore,
    loadingMoreProjects: active.loadingMore,
    onLoadMoreProjects: active.loadMore,
    completedPaging: toPaging(completed),
    upcomingPaging: toPaging(upcoming),
  };
}
