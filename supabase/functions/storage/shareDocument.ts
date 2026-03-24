// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export async function shareDocument(req: Request) {
  try {
    const body = await req.json();

    const { document_id, emails, user_id } = body;

    console.log("document_id", document_id);
    console.log("emails", emails);
    console.log("user_id", user_id);

    if (!document_id || !emails?.length || !user_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    /**
     * ---------------------------------------
     * ✅ 1. Check permission (must be WRITE)
     * ---------------------------------------
     */
    const { data: permissionData, error: permissionError } = await supabase
      .from("document_permissions")
      .select("permission")
      .eq("user_id", user_id)
      .eq("document_id", Number(document_id))
      .maybeSingle();

    if (permissionError || !permissionData) {
      return new Response(JSON.stringify({ error: "No access" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    if (permissionData.permission !== "write") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    /**
     * ---------------------------------------
     * ✅ 2. Get users by emails
     * ---------------------------------------
     */
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email")
      .in("email", emails);

    if (usersError) {
      return new Response(JSON.stringify({ error: usersError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ error: "No users found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    /**
     * ---------------------------------------
     * ✅ 3. Prepare inserts
     * ---------------------------------------
     */
    const permissionsToInsert = users.map((u) => ({
      user_id: u.id,
      document_id: Number(document_id),
      permission: "read",
    }));

    /**
     * ---------------------------------------
     * ✅ 4. Insert permissions
     * ---------------------------------------
     */
    const { error: insertError } = await supabase
      .from("document_permissions")
      .insert(permissionsToInsert);

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    /**
     * ---------------------------------------
     * ✅ 5. Response
     * ---------------------------------------
     */
    return new Response(
      JSON.stringify({
        success: true,
        shared_with: users.map((u) => u.email),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("[shareDocument]", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}
