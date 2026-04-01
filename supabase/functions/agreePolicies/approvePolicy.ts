// @ts-nocheck

import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { ApprovePolicySchema, ApprovePolicyResponseSchema } from "./zod.ts";

export const approvePolicy = async (req: Request) => {
  try {
    const body = await req.json();

    const parsedBody = ApprovePolicySchema.safeParse(body);

    if (!parsedBody.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid request body",
          details: parsedBody.error.flatten(),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { userId, notionUrl } = parsedBody.data;

    // 1️⃣ Mark user as approved and save the policy URL
    const { data, error } = await supabase
      .from("users")
      .update({ policies_approved: true, policy_notion_url: notionUrl ?? null })
      .eq("id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    const responsePayload = { success: true, user: data };

    const parsedOutput = ApprovePolicyResponseSchema.safeParse(responsePayload);

    if (!parsedOutput.success) {
      console.error("[Approve Policy Response Validation Error]", parsedOutput.error.flatten());
      return new Response(JSON.stringify({ error: "Invalid response format" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(parsedOutput.data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Approve Policy Error]", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};
