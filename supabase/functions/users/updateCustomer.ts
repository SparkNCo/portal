// @ts-nocheck
import { supabase } from "../client.ts";
import { escapeIlike } from "../utils/slug.ts";

// Trims and validates a candidate clientName, enforcing the same
// case-insensitive uniqueness rule as createCustomerFlow — clientName
// doubles as a display/URL key elsewhere, so two customers differing only
// by case would collide.
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

// A "Preview Link" is a { url, text } pair — e.g. a link to the customer's
// test environment, shown at the top of every one of their issues' Demo tab.
// Validated defensively since this is stored as-is in jsonb: must be an
// array of plain objects with non-empty string `url`/`text`, `url` an actual
// http(s) URL. Empty/whitespace-only entries are dropped rather than
// rejecting the whole save — easier to recover from a stray blank row added
// in the UI than to force the admin to hunt it down.
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

// Updates fields on the `customers` record itself (as opposed to `updateUser`,
// which only touches the `users` table) — Stripe Customer ID (Settings/Billing),
// clientName (set-password, so a customer's display name can be fixed up the
// first time they log in), and Preview Links (admin/developer-managed, shown
// on the Demo tab and Demos dashboard). Only touches fields actually present
// in the body, so e.g. a clientName-only call never wipes out an existing
// Stripe ID.
//
// `caller` is the requester's own identity, resolved server-side from their
// bearer token by index.ts — never trust body.customer_id for authorization.
// Admins may target any customer; everyone else may only ever touch their
// own record, so a mismatched customer_id is rejected outright rather than
// silently redirected to the caller's own id (a client bug sending the wrong
// id should surface loudly, not write to a different record than intended).
// The one exception is a developer saving *only* preview_links (see
// isPreviewLinksOnlySave below) — developers have no customer_id of their
// own, so they're allowed past the ownership check for that one field.
export const updateCustomer = async (
  body: any,
  schema: string,
  caller: { role: string | null; customerId: string | null },
) => {
  const { customer_id, stripe_customer_id, clientName, linear_slug, preview_links } = body;

  if (!customer_id) {
    throw new Error("customer_id is required");
  }

  // Developers manage Preview Links (aka "Test Environments") inline from
  // wherever they show up (Demo tab, Demos dashboard), not just from Admin →
  // Users like an admin would — but only for a preview-links-only save.
  // Developers have no `customerId` of their own to compare against (they're
  // not tied to one customer record), so without scoping this to a
  // links-only body a developer could otherwise ride this same call to
  // rewrite an arbitrary customer's clientName/Stripe id too.
  const isPreviewLinksOnlySave =
    preview_links !== undefined &&
    stripe_customer_id === undefined &&
    clientName === undefined &&
    linear_slug === undefined;
  const canManagePreviewLinks = caller.role === "admin" || caller.role === "developer";

  if (
    !(isPreviewLinksOnlySave && canManagePreviewLinks) &&
    caller.role !== "admin" &&
    customer_id !== caller.customerId
  ) {
    throw new Error("Not authorized to update this customer");
  }

  // Preview Links are admin/developer-managed — a customer editing their own
  // record (clientName, Stripe id) shouldn't also be able to set the links
  // shown on their own Demo tabs.
  if (preview_links !== undefined && !canManagePreviewLinks) {
    throw new Error("Only an admin or developer can set preview links");
  }

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

  if (linear_slug !== undefined) {
    const trimmedSlug = typeof linear_slug === "string" ? linear_slug.trim() : "";
    if (!trimmedSlug) throw new Error("linear_slug cannot be empty");
    updateFields.linear_slug = trimmedSlug;
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

  return data;
};
