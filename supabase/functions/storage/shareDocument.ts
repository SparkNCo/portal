// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export async function shareDocument(req: Request, schema: string) {
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

    // 1. Check permission (must be WRITE, or an admin — admins can share
    // any document regardless of their own document_permissions row)
    const { data: callerUser } = await supabase.schema(schema)
      .from("users")
      .select("role")
      .eq("id", user_id)
      .maybeSingle();

    if (callerUser?.role !== "admin") {
      const { data: permissionData, error: permissionError } = await supabase.schema(schema)
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

      if (!["write", "owner"].includes(permissionData.permission)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: corsHeaders,
        });
      }
    }

    // 2. Get users by emails
    const { data: users, error: usersError } = await supabase.schema(schema)
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

    // 3. Skip anyone who already has access — the share picker lists the
    // whole initiative, which includes the owner and people with write, and
    // a second "read" row would duplicate (or downgrade) theirs.
    const { data: existing, error: existingError } = await supabase.schema(schema)
      .from("document_permissions")
      .select("user_id")
      .eq("document_id", Number(document_id))
      .in("user_id", users.map((u) => u.id));

    if (existingError) {
      return new Response(JSON.stringify({ error: existingError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const alreadyHasAccess = new Set((existing ?? []).map((p) => p.user_id));
    const newUsers = users.filter((u) => !alreadyHasAccess.has(u.id));

    // 4. Insert permissions
    if (newUsers.length > 0) {
      const { error: insertError } = await supabase.schema(schema)
        .from("document_permissions")
        .insert(newUsers.map((u) => ({
          user_id: u.id,
          document_id: Number(document_id),
          permission: "read",
        })));

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // 5. Response
    return new Response(
      JSON.stringify({
        success: true,
        shared_with: newUsers.map((u) => u.email),
        already_had_access: users.filter((u) => alreadyHasAccess.has(u.id)).map((u) => u.email),
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
