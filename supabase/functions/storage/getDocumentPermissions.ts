// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// GET /storage/permissions?document_id=&user_id= — who already has access to
// a document ([{ email, permission }]), so the Share picker can mark them.
// Same gate as sharing: the caller needs a permission on the document, or to
// be an admin.
export async function getDocumentPermissions(req: Request, schema: string) {
  const { searchParams } = new URL(req.url);
  const documentId = Number(searchParams.get("document_id"));
  const userId = searchParams.get("user_id");

  if (!documentId || !userId) {
    return json({ error: "document_id and user_id are required" }, 400);
  }

  const { data: caller } = await supabase.schema(schema)
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (caller?.role !== "admin") {
    // limit(1): older shares could leave duplicate rows for one user.
    const { data: own } = await supabase.schema(schema)
      .from("document_permissions")
      .select("permission")
      .eq("user_id", userId)
      .eq("document_id", documentId)
      .limit(1);
    if (!own?.length) return json({ error: "No access" }, 403);
  }

  const { data: permissions, error } = await supabase.schema(schema)
    .from("document_permissions")
    .select("user_id, permission")
    .eq("document_id", documentId);
  if (error) return json({ error: error.message }, 500);

  const userIds = (permissions ?? []).map((p) => p.user_id);
  if (userIds.length === 0) return json([]);

  const { data: users, error: usersError } = await supabase.schema(schema)
    .from("users")
    .select("id, email")
    .in("id", userIds);
  if (usersError) return json({ error: usersError.message }, 500);

  const emailById = new Map((users ?? []).map((u) => [u.id, u.email]));
  return json(
    (permissions ?? [])
      .filter((p) => emailById.get(p.user_id))
      .map((p) => ({ email: emailById.get(p.user_id), permission: p.permission })),
  );
}
