"use client";

import { Header } from "@/components/headerDashboard";
import { LoadingDataPanel } from "@/components/loader";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter, usePathname, useParams } from "next/navigation";
import { RequestProjectDialog } from "@/components/client/request-project-dialog";
import { useUser } from "context/UserContext";
import { useCustomerSlug } from "context/CustomerSlugContext";
import { API_HEADERS } from "@/lib/api-headers";
import { Button } from "@/components/components/ui/button";
import {
  usePinnedPanels,
  useReorderPinnedPanels,
  useAddPanels,
} from "@/hooks/use-pinned-panels";
import { PinnedPanelRenderer } from "@/components/dashboard/pinned-panel-renderer";
import { SortablePinnedPanel } from "@/components/dashboard/sortable-pinned-panel";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import { DEFAULT_PANEL_IDS, type PinnablePanelId } from "@/lib/pinnable-panels";
import type { Issue } from "@/components/client/issues.types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

export async function fetchIssues(slug: string, ticketStatuses: string[] = []) {
  const statuses = [...new Set(ticketStatuses)];

  const params = new URLSearchParams({
    slug,
    ticket_statuses: statuses.join(","),
  });
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/issues?${params.toString()}`,
    { headers: API_HEADERS },
  );
  console.log("END CCALL");

  if (!res.ok) throw new Error("Failed to fetch issues");
  return res.json();
}

export async function fetchPoliciesStatus(userId: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/agreePolicies/check?user_id=${userId}`,
    { headers: API_HEADERS },
  );
  if (!res.ok) throw new Error("Failed to fetch policy status");
  return res.json();
}

export default function ClientDashboard() {
  const { profile } = useUser();
  const customerSlug = useCustomerSlug();
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const slug = customerSlug ?? urlSlug ?? profile?.linear_slug ?? "";
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    new Set(),
  );
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);

  // 🔹 Issues query
  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ["linear-issues", slug],
    queryFn: () => fetchIssues(slug),
    enabled: !!slug,
  });

  const allIssues: any[] = issuesData ?? [];

  const { data: pinnedPanels } = usePinnedPanels(profile?.id);
  const reorderPinnedPanels = useReorderPinnedPanels(profile?.id);
  const addPanels = useAddPanels(profile?.id);
  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handlePinnedPanelsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !pinnedPanels) return;

    const oldIndex = pinnedPanels.findIndex((p) => p.panel_id === active.id);
    const newIndex = pinnedPanels.findIndex((p) => p.panel_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(pinnedPanels, oldIndex, newIndex);
    reorderPinnedPanels.mutate(reordered.map((p) => p.panel_id));
  };

  const pinnedIds = new Set(pinnedPanels?.map((p) => p.panel_id) ?? []);
  const missingDefaultPanels = DEFAULT_PANEL_IDS.filter(
    (id) => !pinnedIds.has(id),
  );

  const projects: { id: string; name: string }[] = Array.from(
    new Map(
      allIssues
        .filter((i: any) => i.project?.id && i.project?.name)
        .map((i: any) => [
          i.project.id,
          { id: i.project.id, name: i.project.name },
        ]),
    ).values(),
  );

  const toggleProject = (id: string) =>
    setSelectedProjects((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleOpenChat = (title: string) => {
    const chatPath = pathname.replace(/\/[^/]+$/, "/chat");
    router.push(`${chatPath}?newChat=${encodeURIComponent(title)}`);
  };

  if (issuesLoading) return <LoadingDataPanel />;

  return (
    <div className="min-h-screen">

      <Header
        title={
          profile?.role === "stakeholder"
            ? "Stakeholder Dashboard"
            : "Client Dashboard"
        }
        subtitle={`Welcome back, ${profile?.email ?? "User"}`}
      />
      <div className="p-4 md:p-6 space-y-6 ">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => setSelectedProjects(new Set())}
              className={
                selectedProjects.size === 0
                  ? "bg-accent text-accent-foreground hover:bg-accent/90"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }
            >
              All
            </Button>
            {projects.map((p) => (
              <Button
                key={p.id}
                size="sm"
                onClick={() => toggleProject(p.id)}
                className={
                  selectedProjects.has(p.id)
                    ? "bg-accent text-accent-foreground hover:bg-accent/90"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }
              >
                {p.name}
              </Button>
            ))}
          </div>
          <RequestProjectDialog
            slug={slug}
            requestedBy={profile?.email}
            compact
          />
        </div>
        <h2 className="text-sm font-medium text-muted-foreground">
          Your Panels
        </h2>

        {pinnedPanels && pinnedPanels.length > 0 ? (
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragEnd={handlePinnedPanelsDragEnd}
          >
            <SortableContext
              items={pinnedPanels.map((p) => p.panel_id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {pinnedPanels.map((pin) => (
                  <SortablePinnedPanel key={pin.panel_id} id={pin.panel_id}>
                    <PinnedPanelRenderer
                      panelId={pin.panel_id as PinnablePanelId}
                      slug={slug}
                      allIssues={allIssues}
                      selectedProjectIds={selectedProjects}
                      onOpenChat={handleOpenChat}
                      onEditIssue={(issue) => setEditingIssue(issue)}
                    />
                  </SortablePinnedPanel>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/40 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Pin your favorite panels from Monitor, Build, or Bugs to see
              them here.
            </p>
            {missingDefaultPanels.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => addPanels.mutate(missingDefaultPanels)}
                disabled={addPanels.isPending}
              >
                Add default panels
              </Button>
            )}
          </div>
        )}
      </div>

      {editingIssue && (
        <EditIssueModal
          issue={editingIssue}
          slug={slug}
          onClose={() => setEditingIssue(null)}
        />
      )}
    </div>
  );
}
