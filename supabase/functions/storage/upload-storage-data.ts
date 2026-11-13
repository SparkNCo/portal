// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { grantAccess } from "./access.ts";
import { upsertDocumentVector } from "../lib/vector.ts";
import { extractDocumentText } from "../utils/documentText.ts";
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

    // 1. Get user from DB
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

    // Owner = uploader, except when fulfilling a Document Request (owner = requester).
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

    // 2. Upload file to storage
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

    // 3. Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    const fileUrl = publicUrlData.publicUrl;

    // 4. Insert Document
    const { data: document, error: dbError } = await supabase.schema(schema)
      .from("documents")
      .insert({
        link: fileUrl,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        category,
        file_name: file.name,
        project_slug,
        // Everyone on the initiative sees it, including people who join
        // later (storage/access.ts).
        initiative_wide: !!project_slug,
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

    // 5. Access for the uploader and, when fulfilling a Document Request, the
    // requester (owner_email): both have it by default. There's no owner any
    // more, just access (see storage/access.ts).
    try {
      await grantAccess(schema, document.id, [uploader_id, owner_id]);
    } catch (permissionError) {
      console.error("[Permission Insert Error]", permissionError);
      // Roll back the document so it isn't left without anyone who can see it.
      await supabase.schema(schema).from("documents").delete().eq("id", document.id);
      return new Response(
        JSON.stringify({ error: "Failed to assign permissions", details: String(permissionError?.message ?? permissionError) }),
        { status: 500, headers: corsHeaders },
      );
    }

    // 5a. Vectorize for document search, fire-and-forget. Skipped without
    // project_slug (the namespace) or EdgeRuntime (local runs).
    if (project_slug && typeof EdgeRuntime !== "undefined") {
      EdgeRuntime.waitUntil(
        (async () => {
          const content = await extractDocumentText(file.name, file);
          await upsertDocumentVector(project_slug, {
            id: document.id,
            file_name: file.name,
            category,
            content,
          });
        })(),
      );
    }

    // 5b. The initiative itself needs no rows: the document is
    // initiative_wide, so everyone on it has access while they're on it.
    // shared_with_emails, if a caller sends anyone else, get their own access.
    // Best-effort: the uploader (and requester) already have access.
    try {
      const sharedEmails = (shared_with_emails ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      if (sharedEmails.length) {
        const { data: sharedUsers } = await supabase.schema(schema).from("users").select("id").in("email", sharedEmails);
        await grantAccess(schema, document.id, (sharedUsers ?? []).map((u) => u.id));
      }
    } catch (shareError) {
      console.error("[Shared Access Insert Error] (non-fatal)", shareError);
    }

    // 6. Response
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
