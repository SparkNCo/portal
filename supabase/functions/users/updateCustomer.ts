// @ts-nocheck
import { supabase } from "../client.ts";
import { escapeIlike } from "../utils/slug.ts";

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

// Updates the `customers` row (Stripe id, clientName, Preview Links). Only
// fields present in the body are touched.
//
// Authorization uses `caller` (resolved from the bearer token), never
// body.customer_id. Admins may edit any customer; others only their own — a
// mismatched id is rejected, not redirected. Exception: developers may save
// preview_links only (see isPreviewLinksOnlySave).
export const updateCustomer = async (
  body: any,
  schema: string,
  caller: { role: string | null; customerId: string | null },
) => {
  const { customer_id, stripe_customer_id, clientName, linear_slug, preview_links } = body;

  if (!customer_id) {
    throw new Error("customer_id is required");
  }

  // Developers have no customerId to check against, so they're limited to a
  // links-only body — otherwise they could rewrite any customer's clientName/Stripe id.
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

  // Preview Links are admin/developer-managed; customers can't set them.
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
