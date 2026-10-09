// @ts-nocheck
import { supabase } from "../client.ts";
import { diagramExtension } from "./diagramFormat.ts";

const DIAGRAMS_BUCKET = "diagrams_bucket";

// Replaces the content of an existing diagram version in place (same
// service_id/version) rather than creating a new version.
export const updateDiagram = async (req: Request, schema: string) => {
  const formData = await req.formData();

  const file = formData.get("file") as File | null;
  const diagram_id = formData.get("diagram_id") as string | null;
  const email = formData.get("email") as string | null;

  if (!file) throw new Error("file is required");
  if (!diagram_id) throw new Error("diagram_id is required");
  if (!email) throw new Error("email is required");

  const { data: uploader, error: uploaderError } = await supabase.schema(schema)
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (uploaderError) throw new Error(uploaderError.message);
  if (!uploader) throw new Error("Uploader not found");

  const { data: existing, error: existingError } = await supabase.schema(schema)
    .from("diagrams")
    .select("id, storage_path")
    .eq("id", diagram_id)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new Error("Diagram version not found");

  // Same version, but the new file may be the other format (.mmd ↔ .md) —
  // the extension is what records it (see diagramFormat.ts).
  const storagePath = existing.storage_path.replace(/\.[^./]+$/, "") + `.${diagramExtension(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(DIAGRAMS_BUCKET)
    .upload(storagePath, file, {
      contentType: "text/plain",
      upsert: true,
    });

  if (uploadError) {
    console.error("[updateDiagram] storage upload failed", uploadError.message);
    throw new Error(uploadError.message);
  }

  const mermaid_source = await file.text();

  const { data: diagram, error: updateError } = await supabase.schema(schema)
    .from("diagrams")
    .update({ mermaid_source, storage_path: storagePath, uploaded_by: uploader.id })
    .eq("id", diagram_id)
    .select()
    .single();

  if (updateError) {
    console.error("[updateDiagram] diagram update failed", updateError.message);
    throw new Error(updateError.message);
  }

  // Format changed: the old file is no longer referenced.
  if (storagePath !== existing.storage_path) {
    await supabase.storage.from(DIAGRAMS_BUCKET).remove([existing.storage_path]);
  }

  return diagram;
};
