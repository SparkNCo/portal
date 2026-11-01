// @ts-nocheck
import { supabase } from "../client.ts";
import { escapeIlike } from "../utils/slug.ts";
import { resolveTicketSystem, saveTicketSystem } from "./ticketSystemSettings.ts";

// clientName is also a URL key, so uniqueness is case-insensitive (same as createCustomerFlow).
async function resolveClientName(
  schema: string,
  customerId: string,
  clientName: unknown,
): Promise<string> {
  const trimmedClientName =
    typeof clientName === "string" ? clientName.trim() : "";
  if (!trimmedClientName) throw new Error("clientName cannot be empty");

  const { data: existingClient, error: existingClientError } = await supabase
    .schema(schema)
    .from("customers")
    .select("customer_id")
    .ilike("clientName", escapeIlike(trimmedClientName))
    .neq("customer_id", customerId)
    .maybeSingle();

  if (existingClientError) throw new Error(existingClientError.message);
  if (existingClient)
    throw new Error(`A customer named "${trimmedClientName}" already exists`);

  return trimmedClientName;
}

// Preview Links ({ url, text }, shown on the Demo tab) are stored as-is in
// jsonb, so validate strictly: non-empty strings, http(s) url. Blank rows
// are dropped instead of failing the whole save.
function resolvePreviewLinks(previewLinks: unknown): { url: string; text: string }[] {
  if (!Array.isArray(previewLinks)) {
    throw new Error("preview_links must be an array");
  }

  return previewLinks
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const url = typeof entry.url === "string" ? entry.url.trim() : "";
      const text = typeof entry.text === "string" ? entry.text.trim() : "";
      if (!url && !text) return null;
      if (!url || !text) {
        throw new Error("Each preview link needs both a description and a URL");
      }
      const isValidHttpUrl = (() => {
        try {
          return ["http:", "https:"].includes(new URL(url).protocol);
        } catch {
          return false;
        }
      })();
      if (!isValidHttpUrl) {
        throw new Error(`"${url}" is not a valid URL`);
      }
      return { url, text };
    })
    .filter((entry): entry is { url: string; text: string } => entry !== null);
}

// The Linear slug / Jira project key to save, or undefined to leave it. With
// a ticket-system change it's the id that change already checked.
function resolveSlug(linearSlug: unknown, tickets: { projectId: string } | null): string | undefined {
  if (tickets) {
    return tickets.projectId;
  }
  if (linearSlug === undefined) {
    return undefined;
  }
  const trimmedSlug = typeof linearSlug === "string" ? linearSlug.trim() : "";
  if (!trimmedSlug) {
    throw new Error("linear_slug cannot be empty");
  }
  return trimmedSlug;
}

// Authorization uses `caller` (resolved from the bearer token), never
// body.customer_id. Admins may edit any customer; others only their own — a
// mismatched id is rejected, not redirected. Exception: developers may save
// preview_links only (see isPreviewLinksOnlySave). The ticket system (and
// Jira credentials) are admin-only.
function assertCanUpdate(body: any, caller: { role: string | null; customerId: string | null }) {
  const { customer_id, stripe_customer_id, clientName, linear_slug, preview_links, ticket_system } = body;

  // Developers have no customerId to check against, so they're limited to a
  // links-only body — otherwise they could rewrite any customer's clientName/Stripe id.
  const isPreviewLinksOnlySave =
    preview_links !== undefined &&
    stripe_customer_id === undefined &&
    clientName === undefined &&
    linear_slug === undefined &&
    ticket_system === undefined;
  const canManagePreviewLinks = caller.role === "admin" || caller.role === "developer";

  if (
    !(isPreviewLinksOnlySave && canManagePreviewLinks) &&
    caller.role !== "admin" &&
    customer_id !== caller.customerId
  ) {
    throw new Error("Not authorized to update this customer");
  }

  // Preview Links are admin/developer-managed; customers can't set them.
  if (preview_links !== undefined && !canManagePreviewLinks) {
    throw new Error("Only an admin or developer can set preview links");
  }

  if (ticket_system !== undefined && caller.role !== "admin") {
    throw new Error("Only an admin can change the ticket system");
  }
}

// Updates the `customers` row (Stripe id, clientName, Linear slug / Jira
// project key, Preview Links, ticket system). Only fields present in the
// body are touched.
export const updateCustomer = async (
  body: any,
  schema: string,
  caller: { role: string | null; customerId: string | null },
) => {
  const { customer_id, stripe_customer_id, clientName, linear_slug, preview_links, ticket_system } = body;

  if (!customer_id) {
    throw new Error("customer_id is required");
  }

  assertCanUpdate(body, caller);

  // For Jira the connection is tested here, before anything is written.
  const tickets = ticket_system === undefined ? null : await resolveTicketSystem(body, linear_slug, customer_id);

  const updateFields: Record<string, unknown> = {};

  if (stripe_customer_id !== undefined) {
    updateFields.stripe_customer_id =
      typeof stripe_customer_id === "string" && stripe_customer_id.trim()
        ? stripe_customer_id.trim()
        : null;
  }

  if (clientName !== undefined) {
    updateFields.clientName = await resolveClientName(schema, customer_id, clientName);
  }

  const slug = resolveSlug(linear_slug, tickets);
  if (slug !== undefined) {
    updateFields.linear_slug = slug;
  }

  if (preview_links !== undefined) {
    updateFields.preview_links = resolvePreviewLinks(preview_links);
  }

  if (Object.keys(updateFields).length === 0) {
    throw new Error("No fields to update");
  }

  const { data, error } = await supabase.schema(schema)
    .from("customers")
    .update(updateFields)
    .eq("customer_id", customer_id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (tickets) data.systems = await saveTicketSystem(schema, customer_id, data.systems, tickets);

  return data;
};
