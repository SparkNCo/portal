// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { UploadStorageInputSchema, UploadStorageResponseSchema } from "./zod.ts";

export async function uploadStorageData(req: Request) {
  try {
    const formData = await req.formData();

    const rawInput = {
      file: formData.get("file"),
      bucket: formData.get("bucket"),
      path: formData.get("path"),
      owner_id: formData.get("user_id"),
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

    const { file, bucket, path, owner_id, category } = parsedInput.data;

    /* -----------------------------
       Upload to Storage
    --------------------------------*/

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
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    /* -----------------------------
       Get public URL
    --------------------------------*/

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uploadData.path);

    const fileUrl = publicUrlData.publicUrl;

    /* -----------------------------
       Insert into Document table
    --------------------------------*/

    const { data: document, error: dbError } = await supabase
      .from("Document")
      .insert({
        link: fileUrl,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        category,
        owner_id,
        file_name: file.name,
      })
      .select()
      .single();

    if (dbError) {
      console.error("[Document Insert Error]", dbError);
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

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
      console.error(
        "[Upload Response Validation Error]",
        parsedOutput.error.flatten(),
      );

      return new Response(
        JSON.stringify({ error: "Invalid response format" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
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
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}
