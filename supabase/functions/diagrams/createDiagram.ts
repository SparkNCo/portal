// @ts-nocheck
import { supabase } from "../client.ts";
import { createService } from "./createService.ts";
import { getService } from "./getService.ts";

const DIAGRAMS_BUCKET = "diagrams_bucket";

export const createDiagram = async (req: Request, schema: string) => {
  const formData = await req.formData();

  const file = formData.get("file") as File | null;
  const project_slug = formData.get("project_slug") as string | null;
  const service_id = formData.get("service_id") as string | null;
  const service_name = formData.get("service_name") as string | null;
  const issue_id = formData.get("issue_id") as string | null;
  const email = formData.get("email") as string | null;

  if (!file) throw new Error("file is required");
  if (!project_slug) throw new Error("project_slug is required");
  if (!issue_id) throw new Error("issue_id is required");
  if (!email) throw new Error("email is required");
  if (!service_id && !service_name) {
    throw new Error("service_id or service_name is required");
  }

  const { data: uploader, error: uploaderError } = await supabase.schema(schema)
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (uploaderError) throw new Error(uploaderError.message);
  if (!uploader) throw new Error("Uploader not found");

  const service = service_id
    ? await getService(service_id, project_slug, schema)
    : await createService(project_slug, service_name, uploader.id, schema);

  const { data: latest, error: latestError } = await supabase.schema(schema)
    .from("diagrams")
    .select("version")
    .eq("service_id", service.id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw new Error(latestError.message);

  const version = (latest?.version ?? 0) + 1;
  const storagePath = `diagrams/${service.id}/v${version}.mmd`;

  const { error: uploadError } = await supabase.storage
    .from(DIAGRAMS_BUCKET)
    .upload(storagePath, file, {
      contentType: "text/plain",
      upsert: false,
    });

  if (uploadError) {
    console.error("[createDiagram] storage upload failed", uploadError.message);
    throw new Error(uploadError.message);
  }

  const mermaid_source = await file.text();

  const { data: diagram, error: insertError } = await supabase.schema(schema)
    .from("diagrams")
    .insert({
      service_id: service.id,
      issue_id,
      version,
      storage_path: storagePath,
      mermaid_source,
      uploaded_by: uploader.id,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[createDiagram] diagram insert failed", insertError.message);
    await supabase.storage.from(DIAGRAMS_BUCKET).remove([storagePath]);
    throw new Error(insertError.message);
  }

  return { service, diagram };
};
