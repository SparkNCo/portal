// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { initiativeUserIds } from "./access.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// GET /storage/permissions?document_id=&user_id= — who has access to a
// document ([{ email, permission: "access" }]), for the Share modal. Same
// gate as sharing: the caller needs access to the document, or to be an admin.
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

  // An initiative_wide document is also everyone's on its initiative.
  const { data: doc } = await supabase.schema(schema)
    .from("documents")
    .select("initiative_wide, project_slug")
    .eq("id", documentId)
    .maybeSingle();
  const initiativeIds = doc?.initiative_wide ? await initiativeUserIds(schema, doc.project_slug) : [];

  const userIds = [...new Set([...(permissions ?? []).map((p) => p.user_id), ...initiativeIds])];
  if (userIds.length === 0) return json([]);

  const { data: users, error: usersError } = await supabase.schema(schema)
    .from("users")
    .select("id, email")
    .in("id", userIds);
  if (usersError) return json({ error: usersError.message }, 500);

  const emailById = new Map((users ?? []).map((u) => [u.id, u.email]));
  return json(
    userIds.filter((id) => emailById.get(id)).map((id) => ({ email: emailById.get(id), permission: "access" })),
  );
}
