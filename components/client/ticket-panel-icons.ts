import { Bug, CircleCheck, Clock, FlaskConical, ListTodo, Scale, type LucideIcon } from "lucide-react";

// The icon left of each ticket panel's title, the same on its own page
// (Build, Bugs) and pinned on the Dashboard. By pinned panel id.
export const TICKET_PANEL_ICONS: Record<string, LucideIcon> = {
  // Waiting for the client's decision.
  build_product_decisions: Scale,
  // In UAT, for the client to test.
  build_acceptance_testing: FlaskConical,
  // Newest first.
  build_recently_created: Clock,
  // "Refinement": the backlog being refined.
  build_backlog: ListTodo,
  // "Approved": finished.
  build_done: CircleCheck,
  bugs_list: Bug,
};
