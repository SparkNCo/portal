// @ts-nocheck
// Moved to lib/tickets/linear/issues.ts (ticket-system wrapper). Kept for
// suggested-features/generateAllSuggestions.ts until it moves behind the
// wrapper too. `_schema` is ignored (always "portal", as before).
import { syncCustomerLinearProjects as sync } from "../lib/tickets/linear/issues.ts";

export function syncCustomerLinearProjects(customerId: string, linearSlug: string, _schema?: string) {
  return sync(customerId, linearSlug);
}
