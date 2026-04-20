// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { getAllPosts, getPostByURL } from "./contentful-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const { searchParams } = new URL(req.url);
    const rawId = searchParams.get("url");
    const contentType = searchParams.get("contentType");
    const url = rawId ? decodeURIComponent(rawId) : null;

    if (req.method === "GET") {
      if (!url && !contentType) {
        return new Response(
          JSON.stringify({ error: "Provide url or contentType" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }
      console.log("🔍 GET request received with params:", { url, contentType });
      if (!url && !contentType) {
        return new Response(
          JSON.stringify({ error: "Use either url OR contentType" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      if (url) {
        const post = await getPostByURL(url);

        return new Response(JSON.stringify(post), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      if (contentType) {
        const posts = await getAllPosts({ contentType });

        return new Response(JSON.stringify(posts), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }
    }

    if (req.method === "PATCH") {
      if (!url) {
        return new Response(
          JSON.stringify({ error: "Missing url for update" }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      const body = await req.json();
      const { title, author, tags, slide_two, slide_three, slide_three_title } =
        body;
      const updateData: Record<string, any> = {};
      if (title !== undefined) updateData.title = title;
      if (author !== undefined) updateData.author = author;
      if (tags !== undefined) updateData.tags = tags;
      if (slide_two !== undefined) updateData.slide_two = slide_two;
      if (slide_three !== undefined) updateData.slide_three = slide_three;
      if (slide_three_title !== undefined)
        updateData.slide_three_title = slide_three_title;

      const { data, error } = await supabase
        .from("ig_posts")
        .update(updateData)
        .eq("blog_id", url)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[Post API Error]", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
