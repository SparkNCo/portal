// @ts-nocheck
import { supabase } from "../client.ts";

export async function getPostById(id: string) {
  const { data, error } = await supabase
    .from("ig_posts")
    .select(
      `
      blog_id,
      title,
      img,
      author,
      tags,
      slide_two,
      slide_three,
      contentful_id,
      slide_three_title, 
      created_at
    `,
    )
    .eq("blog_id", id)
    .maybeSingle();

  if (error) {
    console.error("Supabase error:", error);
    throw new Error("Failed to fetch post");
  }

  if (!data) {
    throw new Error("Post not found");
  }

  return data;
}
