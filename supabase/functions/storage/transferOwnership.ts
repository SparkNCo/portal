// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

// POST /storage/transfer-owner — admin-only. Reassigns a document's "owner"
// permission to a different user (typically one of the initiative's own
// assigned members) — e.g. the original uploader left the company and
// someone else needs delete/share/category rights on their documents.
// The previous owner is downgraded to "write" (keeps edit access, loses
// delete) rather than removed outright, same idea as shareDocument.ts
// granting "read" — nobody's access silently disappears.
export async function transferOwnership(req: Request, schema: string) {
  try {
    const body = await req.json();
    const { document_id, new_owner_id, user_id } = body;

    if (!document_id || !new_owner_id || !user_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /**
     * ---------------------------------------
     * ✅ 1. Caller must be admin
     * ---------------------------------------
     */
    const { data: callerUser } = await supabase.schema(schema)
      .from("users")
      .select("role")
      .eq("id", user_id)
      .maybeSingle();

    if (callerUser?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /**
     * ---------------------------------------
     * ✅ 2. Downgrade the current owner(s) to "write"
     * ---------------------------------------
     */
    const { error: downgradeError } = await supabase.schema(schema)
      .from("document_permissions")
      .update({ permission: "write" })
      .eq("document_id", Number(document_id))
      .eq("permission", "owner");

    if (downgradeError) {
      return new Response(JSON.stringify({ error: downgradeError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /**
     * ---------------------------------------
     * ✅ 3. Set the new owner's permission row to "owner" — update in place
     * if they already have some permission on this document (e.g. they were
     * shared read/write access earlier), otherwise insert a fresh row.
     * Avoids relying on a specific named unique constraint for .upsert().
     * ---------------------------------------
     */
    const { data: existingPermission } = await supabase.schema(schema)
      .from("document_permissions")
      .select("user_id")
      .eq("document_id", Number(document_id))
      .eq("user_id", new_owner_id)
      .maybeSingle();

    const { error: setOwnerError } = existingPermission
      ? await supabase.schema(schema)
          .from("document_permissions")
          .update({ permission: "owner" })
          .eq("document_id", Number(document_id))
          .eq("user_id", new_owner_id)
      : await supabase.schema(schema)
          .from("document_permissions")
          .insert({ document_id: Number(document_id), user_id: new_owner_id, permission: "owner" });

    if (setOwnerError) {
      return new Response(JSON.stringify({ error: setOwnerError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[transferOwnership]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
