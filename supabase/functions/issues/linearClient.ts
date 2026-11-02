// @ts-nocheck
// Moved to lib/tickets/linear/client.ts (ticket-system wrapper). Kept so the
// functions not moved behind the wrapper yet (suggested-features, cometchat,
// demo-videos, linear-vector-sync) keep importing from here.
export {
  linearRequest,
  GET_PROJECT_TEAM_QUERY,
  GET_TEAM_LABELS_QUERY,
  GET_INITIATIVE_PROJECTS_QUERY,
  isClosedProject,
  closedProjectError,
} from "../lib/tickets/linear/client.ts";
