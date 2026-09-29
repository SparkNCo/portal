// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

// POST /storage/transfer-owner — admin-only. Reassigns a document's "owner"
// (e.g. the uploader left). The previous owner is downgraded to "write", not
// removed, so nobody's access silently disappears.
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

    // 1. Caller must be admin
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

    // 2. Downgrade the current owner(s) to "write"
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

    // 3. Set the new owner — update their existing row or insert one
    // (manual, since there's no named unique constraint for .upsert()).
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
