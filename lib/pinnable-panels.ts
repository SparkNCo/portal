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

export const PINNABLE_PANELS: Record<
  PinnablePanelId,
  { label: string; sourceDashboard: "monitor" | "build" | "bugs" }
> = {
  progress_pie_chart: { label: "Project Status", sourceDashboard: "monitor" },
  software_kpis: { label: "SDLC Metrics", sourceDashboard: "monitor" },
  roadmap_timeline: { label: "Roadmap Timeline", sourceDashboard: "monitor" },
  metrics_panel: { label: "Cycle & Issue Metrics", sourceDashboard: "monitor" },
  build_product_decisions: {
    label: "Business Review",
    sourceDashboard: "build",
  },
  build_acceptance_testing: {
    label: "Acceptance Testing",
    sourceDashboard: "build",
  },
  build_recently_created: { label: "Recently Created", sourceDashboard: "build" },
  build_backlog: { label: "Refinement", sourceDashboard: "build" },
  build_done: { label: "Approved", sourceDashboard: "build" },
  bugs_list: { label: "Bugs", sourceDashboard: "bugs" },
};

export const DEFAULT_PANEL_IDS: PinnablePanelId[] = [
  "progress_pie_chart",
  "software_kpis",
  "build_product_decisions",
  "build_acceptance_testing",
];
