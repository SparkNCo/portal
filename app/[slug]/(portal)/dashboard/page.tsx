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
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  usePinnedPanels,
  usePinnedPanelsOwnerId,
  useReorderPinnedPanels,
  useAddPanels,
  useTogglePanelWidth,
  useUnpinPanel,
} from "@/hooks/use-pinned-panels";
import { PinnedPanelRenderer } from "@/components/dashboard/pinned-panel-renderer";
import { SortablePinnedPanel } from "@/components/dashboard/sortable-pinned-panel";
import { EditIssueModal } from "@/components/build/edit-issue-modal";
import { DEFAULT_PANEL_IDS, type PinnablePanelId } from "@/lib/pinnable-panels";
import type { Issue } from "@/components/client/issues.types";
import { safeDecodeURIComponent } from "@/lib/utils";
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
  if (!res.ok) throw new Error("Failed to fetch issues");
  return res.json();
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  const { slug: rawUrlSlug } = useParams<{ slug: string }>();
  const urlSlug = rawUrlSlug ? safeDecodeURIComponent(rawUrlSlug) : rawUrlSlug;
  const router = useRouter();
  const pathname = usePathname();
  const slug = customerSlug ?? urlSlug ?? profile?.linear_slug ?? "";
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    new Set(),
  );
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);

  // 🔹 Issues query
  const {
    data: issuesData,
    isLoading: issuesLoading,
    isFetching: issuesFetching,
    error: issuesError,
    refetch: refetchIssues,
  } = useQuery({
    queryKey: ["linear-issues", slug],
    queryFn: () => fetchIssues(slug),
    enabled: !!slug,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const allIssues: any[] = issuesData ?? [];

  const pinnedPanelsUserId = usePinnedPanelsOwnerId();
  const { data: pinnedPanels } = usePinnedPanels(pinnedPanelsUserId);
  const reorderPinnedPanels = useReorderPinnedPanels(pinnedPanelsUserId);
  const addPanels = useAddPanels(pinnedPanelsUserId);
  const togglePanelWidth = useTogglePanelWidth(pinnedPanelsUserId);
  const unpinPanel = useUnpinPanel(pinnedPanelsUserId);
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
        title="Dashboard"
        subtitle={`Welcome back, ${capitalize(profile?.firstName ?? profile?.userName ?? profile?.email ?? "User")}`}
      />
      <div className="p-4 md:p-6 space-y-6 ">
        {issuesError && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Failed to load your issues — panels below may be showing
              incomplete data.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={() => refetchIssues()}
              disabled={issuesFetching}
            >
              {issuesFetching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              {issuesFetching ? "Retrying…" : "Retry"}
            </Button>
          </div>
        )}
        {/* Project filter buttons (All / per-project) hidden for now — may
            come back later. `selectedProjects` stays wired into the pinned
            panels below (progress_pie_chart, build_product_decisions,
            build_acceptance_testing), currently always empty so nothing is
            filtered out. */}
        <div className="flex items-center justify-end gap-3">
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
                  <SortablePinnedPanel
                    key={pin.panel_id}
                    id={pin.panel_id}
                    fullWidth={pin.full_width}
                    onToggleWidth={() =>
                      togglePanelWidth.mutate({
                        panelId: pin.panel_id,
                        fullWidth: !pin.full_width,
                      })
                    }
                    onUnpin={() => unpinPanel.mutate(pin.panel_id)}
                  >
                    <PinnedPanelRenderer
                      panelId={pin.panel_id as PinnablePanelId}
                      slug={slug}
                      allIssues={allIssues}
                      selectedProjectIds={selectedProjects}
                      onOpenChat={handleOpenChat}
                      onEditIssue={(issue) => setEditingIssue(issue)}
                      hidePinButton
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
