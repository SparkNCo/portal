// @ts-nocheck
import { supabase } from "../client.ts";
import { corsHeaders } from "../utils/headers.ts";

export async function getByPasscode(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const passcode = url.searchParams.get("passcode");

    if (!passcode) {
      return new Response(JSON.stringify({ error: "Missing passcode" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

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
      discovery_state,
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
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: features, error: featuresError } = await supabase
      .from("requirements")
      .select(
        `
        id,
        proposal_id,
        submission_id,
        feature_name,
        description,
        purpose,
        integration_text,
        tech_constraints,
        created_at
      `,
      )
      .eq("submission_id", passcode)
      .order("created_at", { ascending: true });

    if (featuresError) {
      console.error("[getByPasscode] Features fetch error:", featuresError);
    }

    return new Response(
      JSON.stringify({ data: { ...proposal, features: features ?? [] } }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
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
