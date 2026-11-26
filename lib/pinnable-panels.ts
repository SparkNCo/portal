export type PinnablePanelId =
  | "progress_pie_chart"
  | "software_kpis"
  | "roadmap_timeline"
  | "metrics_panel"
  | "build_product_decisions"
  | "build_acceptance_testing"
  | "build_recently_created"
  // Shown as "Refinement" (Backlog tickets); the id predates the rename and
  // stays, so panels people already pinned keep working.
  | "build_backlog"
  | "build_done"
  | "bugs_list";

// `fullWidth`: the width a panel is pinned with — as it shows on its own page.
// Ticket panels (Build, Bugs) take the whole width there, so they're pinned
// full width; Monitor's charts sit two per row, so they're pinned half width.
// Only the starting width: it can still be changed on the Dashboard.
export const PINNABLE_PANELS: Record<
  PinnablePanelId,
  { label: string; sourceDashboard: "monitor" | "build" | "bugs"; fullWidth: boolean }
> = {
  progress_pie_chart: { label: "Project Status", sourceDashboard: "monitor", fullWidth: false },
  software_kpis: { label: "SDLC Metrics", sourceDashboard: "monitor", fullWidth: false },
  roadmap_timeline: { label: "Roadmap Timeline", sourceDashboard: "monitor", fullWidth: false },
  metrics_panel: { label: "Cycle & Issue Metrics", sourceDashboard: "monitor", fullWidth: false },
  build_product_decisions: {
    label: "Business Review",
    sourceDashboard: "build",
    fullWidth: true,
  },
  build_acceptance_testing: {
    label: "Acceptance Testing",
    sourceDashboard: "build",
    fullWidth: true,
  },
  build_recently_created: { label: "Recently Created", sourceDashboard: "build", fullWidth: true },
  build_backlog: { label: "Refinement", sourceDashboard: "build", fullWidth: true },
  build_done: { label: "Approved", sourceDashboard: "build", fullWidth: true },
  bugs_list: { label: "Bugs", sourceDashboard: "bugs", fullWidth: true },
};

// The width a panel is pinned with (unknown ids: half, as before).
export function pinnedFullWidth(panelId: string): boolean {
  return PINNABLE_PANELS[panelId as PinnablePanelId]?.fullWidth ?? false;
}

export const DEFAULT_PANEL_IDS: PinnablePanelId[] = [
  "progress_pie_chart",
  "software_kpis",
  "build_product_decisions",
  "build_acceptance_testing",
];
