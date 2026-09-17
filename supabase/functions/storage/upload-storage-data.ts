// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import {
  UploadStorageInputSchema,
  UploadStorageResponseSchema,
} from "./zod.ts";

export async function uploadStorageData(req: Request, schema: string) {
  try {
    const formData = await req.formData();

    const rawInput = {
      file: formData.get("file"),
      bucket: formData.get("bucket"),
      path: formData.get("path"),
      email: formData.get("email"),
      user_id: formData.get("user_id"),
      category: formData.get("category") ?? "document",
      project_slug: formData.get("project_slug") ?? undefined,
      owner_email: formData.get("owner_email") ?? undefined,
      shared_with_emails: formData.get("shared_with_emails") ?? undefined,
    };

    const parsedInput = UploadStorageInputSchema.safeParse(rawInput);

    if (!parsedInput.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid form data",
          details: parsedInput.error.flatten(),
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { file, bucket, path, email, category, project_slug, owner_email, shared_with_emails } =
      parsedInput.data;

    /**
     * ---------------------------------------
     * ✅ 1. Get user from DB
     * ---------------------------------------
     */
    const { data: matchedUser, error: supabaseUserError } = await supabase.schema(schema)
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (supabaseUserError || !matchedUser) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const uploader_id = matchedUser.id;

    // Owner defaults to the uploader (the normal Upload Document panel
    // never sets owner_email) — only differs when fulfilling a Document
    // Request, where the requester should own what they asked for, not
    // whoever happened to upload it.
    let owner_id = uploader_id;
    if (owner_email && owner_email !== email) {
      const { data: ownerUser, error: ownerError } = await supabase.schema(schema)
        .from("users")
        .select("id")
        .eq("email", owner_email)
        .maybeSingle();

      if (ownerError || !ownerUser) {
        return new Response(JSON.stringify({ error: "Owner user not found" }), {
          status: 404,
          headers: corsHeaders,
        });
      }
      owner_id = ownerUser.id;
    }

    /**
     * ---------------------------------------
     * ✅ 2. Upload file to storage
     * ---------------------------------------
     */
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("[Storage Upload Error]", uploadError);

      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    /**
     * ---------------------------------------
     * ✅ 3. Get public URL
     * ---------------------------------------
     */
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    const fileUrl = publicUrlData.publicUrl;

    /**
     * ---------------------------------------
     * ✅ 4. Insert Document
     * ---------------------------------------
     */
    const { data: document, error: dbError } = await supabase.schema(schema)
      .from("documents")
      .insert({
        link: fileUrl,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        category,
        file_name: file.name,
        project_slug,
      })
      .select()
      .single();

    if (dbError) {
      console.error("[Document Insert Error]", dbError);

      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    /**
     * ---------------------------------------
     * ✅ 5. 🔥 INSERT PERMISSION (NEW)
     * ---------------------------------------
     */
    const { error: permissionError } = await supabase.schema(schema)
      .from("document_permissions")
      .insert({
        user_id: owner_id,
        document_id: document.id,
        permission: "owner",
      });

    if (permissionError) {
      console.error("[Permission Insert Error]", permissionError);

      // Optional rollback (recommended)
      await supabase.schema(schema).from("documents").delete().eq("id", document.id);

      return new Response(
        JSON.stringify({ error: "Failed to assign permissions", details: permissionError.message }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    /**
     * ---------------------------------------
     * ✅ 5b. Grant "write" to everyone else who should have it — the
     * uploader (when they're not the owner, e.g. fulfilling a request) plus
     * anyone in shared_with_emails (the initiative's assigned developers, so
     * the rest of the team isn't locked out of a document filed under their
     * own project). Best-effort per-user — one bad email shouldn't undo the
     * document that already exists.
     * ---------------------------------------
     */
    const writeEmails = new Set(
      (shared_with_emails ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
    );
    if (owner_id !== uploader_id) writeEmails.add(email);

    if (writeEmails.size > 0) {
      const { data: writeUsers } = await supabase.schema(schema)
        .from("users")
        .select("id, email")
        .in("email", Array.from(writeEmails));

      const writeUserIds = (writeUsers ?? [])
        .map((u) => u.id)
        .filter((id) => id !== owner_id);

      if (writeUserIds.length > 0) {
        const { error: writeError } = await supabase.schema(schema)
          .from("document_permissions")
          .insert(
            writeUserIds.map((user_id) => ({
              user_id,
              document_id: document.id,
              permission: "write",
            })),
          );
        if (writeError) {
          console.error("[Write Permission Insert Error] (non-fatal)", writeError);
        }
      }
    }

    /**
     * ---------------------------------------
     * ✅ 6. Response
     * ---------------------------------------
     */
    const responsePayload = {
      success: true,
      storage: {
        bucket,
        path: uploadData.path,
        contentType: file.type,
        size: file.size,
      },
      document,
    };

    const parsedOutput = UploadStorageResponseSchema.safeParse(responsePayload);

    if (!parsedOutput.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid response format",
        }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
    }

    return new Response(JSON.stringify(parsedOutput.data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[uploadStorageData]", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
