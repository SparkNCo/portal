// @ts-nocheck
import { supabase } from "../client.ts";

export const createUser = async (body: any) => {
  const {
    email,
    role = "user",
    customer_id = null,
    subscription_id = null,
    linear_initiative_id = null,
    project_ids = null,
    initiative_ids = null,
    projects_slug = null,
    auth_id = null,
  } = body;

  if (!email) {
    throw new Error("Email is required");
  }

  const { data, error } = await supabase
    .from("users")
    .insert([
      {
        email,
        role,
        customer_id,
        subscription_id,
        linear_initiative_id,
        project_ids,
        initiative_ids,
        projects_slug,
        auth_id,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);

  return data;
};
