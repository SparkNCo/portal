// @ts-nocheck
import { supabase } from "../client.ts";
import { validateDesignResourceUrl } from "./validateUrl.ts";

export const createDesignResource = async (req: Request, schema: string) => {
  const body = await req.json();

  const { issue_id, project_slug, resource_type, url, title, description, email } = body;

  // Validate required fields
  if (!issue_id) throw new Error("issue_id is required");
  if (!project_slug) throw new Error("project_slug is required");
  if (!resource_type) throw new Error("resource_type is required");
  if (!url) throw new Error("url is required");
  if (!email) throw new Error("email is required");

  // Validate resource type
  if (resource_type !== "figma" && resource_type !== "v0") {
    throw new Error("resource_type must be 'figma' or 'v0'");
  }

  // Validate URL format
  const validation = validateDesignResourceUrl(url, resource_type);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid URL");
  }

  // Look up user by email
  const { data: user, error: userError } = await supabase
    .schema(schema)
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (userError) throw new Error(userError.message);
  if (!user) throw new Error("User not found");

  // Insert design resource
  const { data: resource, error: insertError } = await supabase
    .schema(schema)
    .from("design_resources")
    .insert({
      issue_id,
      project_slug,
      resource_type,
      url,
      title: title || null,
      description: description || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[createDesignResource] insert failed", insertError.message);
    throw new Error(insertError.message);
  }

  return resource;
};
