// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import {
  UploadStorageInputSchema,
  UploadStorageResponseSchema,
} from "./zod.ts";

export async function uploadStorageData(req: Request) {
  try {
    const formData = await req.formData();

    const rawInput = {
      file: formData.get("file"),
      bucket: formData.get("bucket"),
      path: formData.get("path"),
      email: formData.get("email"),
      user_id: formData.get("user_id"),
      initiative_id: formData.get("initiative_id"),
      category: formData.get("category") ?? "document",
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

    const { file, bucket, path, user_id, email, initiative_id, category } =
      parsedInput.data;

    /**
     * ---------------------------------------
     * ✅ 1. Get user from DB
     * ---------------------------------------
     */
    const { data: matchedUser, error: supabaseUserError } = await supabase
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

    const owner_id = matchedUser.id;

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
    const { data: document, error: dbError } = await supabase
      .from("Document")
      .insert({
        link: fileUrl,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        category,
        owner_id,
        initiative_id,
        file_name: file.name,
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
    const { error: permissionError } = await supabase
      .from("document_permissions")
      .insert({
        user_id: owner_id,
        document_id: document.id,
        permission: "write",
      });

    if (permissionError) {
      console.error("[Permission Insert Error]", permissionError);

      // Optional rollback (recommended)
      await supabase.from("Document").delete().eq("id", document.id);

      return new Response(
        JSON.stringify({ error: "Failed to assign permissions" }),
        {
          status: 500,
          headers: corsHeaders,
        },
      );
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
