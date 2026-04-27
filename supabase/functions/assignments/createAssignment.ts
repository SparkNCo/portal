// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export const createAssignment = async (req: Request) => {
  try {
    const body = await req.json();
    const { user_id, customer_id, role, allocation } = body;

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

    // 🧠 Defaults
    const finalRole = role || "developer";
    const finalAllocation = allocation ?? 40;

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
          role: finalRole,
          allocation: finalAllocation,
          joined: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    // Append the new assignment id into the text[] column for both users
    for (const id of [user_id, customer_id]) {
      const { data: userData, error: fetchError } = await supabase
        .from("users")
        .select("assignment_id")
        .eq("id", id)
        .single();

      if (fetchError) throw new Error(fetchError.message);

      const current: string[] = userData?.assignment_id ?? [];
      const { error: updateError } = await supabase
        .from("users")
        .update({ assignment_id: [...current, data.id] })
        .eq("id", id);

      if (updateError) throw new Error(updateError.message);
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
