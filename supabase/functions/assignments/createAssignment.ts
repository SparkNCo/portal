// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export const createAssignment = async (req: Request) => {
  try {
    const body = await req.json();
    const { user_id, customer_id } = body;

    if (!user_id || !customer_id) {
      return new Response(
        JSON.stringify({ error: "user_id and customer_id are required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // 🔍 Check if already exists
    const { data: existing } = await supabase
      .from("assignments")
      .select("*")
      .eq("user_id", user_id)
      .eq("customer_id", customer_id)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify(existing), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // ✅ Insert assignment
    const { data, error } = await supabase
      .from("assignments")
      .insert([
        {
          user_id,
          customer_id,
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("[Create Assignment Error]", error);

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
};
