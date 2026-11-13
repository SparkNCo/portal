// @ts-nocheck
// Who may act on a document. There's no owner: access is yes or no
// (20261113120000_documents_access_and_soft_delete.sql). A user has access when
//   - they're an admin, or
//   - they have a document_permissions row for it (uploader, requester, or
//     someone it was shared with), or
//   - the document is initiative_wide and they're on its initiative right
//     now: the customer, or a stakeholder / developer assigned to it
//     (20261113130000_documents_initiative_wide.sql). Worked out on every
//     check, so people who join later see it and people who leave don't.
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { escapeIlike } from "../utils/slug.ts";

export const ACCESS = "access";

export async function isAdmin(schema: string, userId: string): Promise<boolean> {
  const { data } = await supabase.schema(schema).from("users").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}

// The initiatives a user is on, as lowercased linear_slugs (what documents
// store as project_slug): their own customer for a customer user, the ones
// they're assigned to for a stakeholder or developer.
export async function userInitiativeSlugs(schema: string, userId: string): Promise<string[]> {
  const { data: user } = await supabase.schema(schema).from("users").select("role, customer_id").eq("id", userId).maybeSingle();
  if (!user) return [];

  let customerIds: string[] = [];
  if (user.role === "customer") {
    customerIds = user.customer_id ? [String(user.customer_id)] : [];
  } else {
    // assignments.customer_id is the customer *user*; their customer_id is
    // the customer.
    const { data: assignments } = await supabase.schema(schema).from("assignments").select("customer_id").eq("user_id", userId);
    const customerUserIds = [...new Set((assignments ?? []).map((a) => a.customer_id).filter(Boolean))];
    if (customerUserIds.length) {
      const { data: customerUsers } = await supabase.schema(schema).from("users").select("customer_id").in("id", customerUserIds);
      customerIds = [...new Set((customerUsers ?? []).map((u) => u.customer_id).filter(Boolean).map(String))];
    }
  }
  if (customerIds.length === 0) return [];

  const { data: customers } = await supabase.schema(schema).from("customers").select("linear_slug").in("customer_id", customerIds);
  return (customers ?? []).map((c) => c.linear_slug?.toLowerCase()).filter(Boolean);
}

export async function hasDocumentAccess(schema: string, userId: string, documentId: number | string): Promise<boolean> {
  if (await isAdmin(schema, userId)) return true;
  const { data } = await supabase.schema(schema)
    .from("document_permissions")
    .select("id")
    .eq("user_id", userId)
    .eq("document_id", Number(documentId))
    .limit(1);
  if (data?.length) return true;

  const { data: doc } = await supabase.schema(schema)
    .from("documents")
    .select("initiative_wide, project_slug")
    .eq("id", Number(documentId))
    .maybeSingle();
  if (!doc?.initiative_wide || !doc.project_slug) return false;
  return (await userInitiativeSlugs(schema, userId)).includes(doc.project_slug.toLowerCase());
}

// The document, unless it's been deleted (soft delete): null either way.
export async function liveDocument(schema: string, documentId: number | string, columns = "*") {
  const { data } = await supabase.schema(schema)
    .from("documents")
    .select(columns)
    .eq("id", Number(documentId))
    .is("deleted_at", null)
    .maybeSingle();
  return data ?? null;
}

// Gives each user access, skipping who already has a row. Returns who got one.
export async function grantAccess(schema: string, documentId: number, userIds: string[]): Promise<string[]> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const { data: existing, error: existingError } = await supabase.schema(schema)
    .from("document_permissions")
    .select("user_id")
    .eq("document_id", documentId)
    .in("user_id", unique);
  if (existingError) throw new Error(existingError.message);
  const has = new Set((existing ?? []).map((p) => p.user_id));
  const toAdd = unique.filter((id) => !has.has(id));
  if (toAdd.length === 0) return [];
  const { error } = await supabase.schema(schema)
    .from("document_permissions")
    .insert(toAdd.map((user_id) => ({ user_id, document_id: documentId, permission: ACCESS })));
  if (error) throw new Error(error.message);
  return toAdd;
}

// Everyone on the initiative a document is filed under (`project_slug` is
// the customer's linear_slug): the customer user and everyone assigned to it
// (developers and stakeholders). For showing who has access to an
// initiative_wide document, and for sharing.
export async function initiativeUserIds(schema: string, projectSlug: string | null | undefined): Promise<string[]> {
  if (!projectSlug) return [];
  const { data: customer } = await supabase.schema(schema)
    .from("customers")
    .select("customer_id")
    .ilike("linear_slug", escapeIlike(projectSlug))
    .maybeSingle();
  if (!customer?.customer_id) return [];
  const { data: customerUser } = await supabase.schema(schema)
    .from("users")
    .select("id")
    .eq("customer_id", customer.customer_id)
    .eq("role", "customer")
    .maybeSingle();
  if (!customerUser?.id) return [];
  const { data: assignments } = await supabase.schema(schema)
    .from("assignments")
    .select("user_id")
    .eq("customer_id", customerUser.id);
  return [customerUser.id, ...(assignments ?? []).map((a) => a.user_id).filter(Boolean)];
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
