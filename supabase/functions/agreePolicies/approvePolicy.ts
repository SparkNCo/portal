// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";
import { ApprovePolicySchema, ApprovePolicyResponseSchema } from "./zod.ts";

export const approvePolicy = async (req: Request) => {
  try {
    const schema = "portal";
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

    // 1️⃣ Mark developer as approved and save the policy URL
    const { data, error } = await supabase.schema(schema)
      .from("developers")
      .upsert(
        { user_id: userId, policies_approved: true, policy_notion_url: notionUrl ?? null },
        { onConflict: "user_id" },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);

    const responsePayload = { success: true, developer: data };

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
