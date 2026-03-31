// update-proposal.ts
// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export async function updateProposal(req: Request): Promise<Response> {
  try {
    const body = await req.json();

    const { passcode, updates } = body;

    const { lead, ...proposalUpdates } = updates;

    const { data: updatedRows, error: updateError } = await supabase
      .from("proposals")
      .update({
        ...proposalUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq("passcode", passcode)
      .select();

    if (updateError) {
      console.error("[PATCH /proposals] Update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update proposal" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    return new Response(JSON.stringify({ data: updatedRows[0] }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (err) {
    console.error("[PATCH /proposals] Unexpected error:", err);

    return new Response(JSON.stringify({ error: "Unexpected server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
}
