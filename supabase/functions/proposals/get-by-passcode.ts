// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { supabase } from "../client.ts";
import { ProposalSchema, ProposalWithLeadSchema, QuerySchema } from "./zod.ts";
import { corsHeaders } from "../utils/headers.ts";

export async function getByPasscode(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);

    const parsedQuery = QuerySchema.safeParse({
      passcode: url.searchParams.get("passcode"),
    });

    if (!parsedQuery.success) {
      return new Response(
        JSON.stringify({
          error: "Invalid query params",
          details: parsedQuery.error.flatten(),
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    const { passcode } = parsedQuery.data;

    const { data: proposal, error } = await supabase
      .from("proposals")
      .select(
        `
    proposal_id,
    lead_id,
    creator_email,
    passcode,
    stage,

    client_name,
    provider_name,
    proposal_title,
    proposal_date,
    valid_until,

    summary,
    problem_and_context,
    solution_overview,

    objectives_and_success_criteria,
    deliverables,
    assumptions_and_dependencies,
    team_and_communication,
    technology_and_architecture,
    change_management_process,
    pricing_and_commercial,
    risk_and_responsabilities,
    assurance_and_quality,
    history_and_case_studies,
    timeline_and_milestones,
    next_steps,

    disclaimer,
    summary_items,
    signatures,

    signature_url,
    signed_at,
    created_at,
    updated_at,

    lead:lead_id (
      description,
      formatted_date,
      estimateTime_min,
      estimateTime_max,
      budget_min,
      budget_max
    )
  `,
      )
      .eq("passcode", passcode)
      .maybeSingle();

    if (error) {
      console.error("[getByPasscode] Supabase error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    if (!proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // ✅ Validate DB response
    const parsedProposal = ProposalWithLeadSchema.safeParse(proposal);

    if (!parsedProposal.success) {
      console.error(
        "[getByPasscode] Invalid proposal shape:",
        parsedProposal.error,
      );

      return new Response(
        JSON.stringify({ error: "Invalid data returned from database" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    return new Response(JSON.stringify({ data: parsedProposal.data }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (err) {
    console.error("[getByPasscode] Unexpected error:", err);

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
}
