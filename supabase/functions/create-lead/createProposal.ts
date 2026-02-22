// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { proposalMockData } from "./proposalMockData.ts";
import { supabase } from "../client.ts";
import { CreateProposalInputSchema } from "./zod.ts";
import { ProposalSchema } from "../proposals/zod.ts";

export const createProposal = async (
  input: z.infer<typeof CreateProposalInputSchema>,
) => {
  // ✅ Validate input
  const parsedInput = CreateProposalInputSchema.safeParse(input);

  if (!parsedInput.success) {
    console.error(
      "[createProposal] Invalid input:",
      parsedInput.error.flatten(),
    );
    throw new Error("Invalid createProposal input");
  }

  const { lead_id, creator_email } = parsedInput.data;

  // 🔑 IDs
  const proposalId = crypto.randomUUID();

  const passcode = Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  // 📦 Extract mock sections
  const cover = proposalMockData["Cover Page"];
  const timeline = proposalMockData["Timeline & Milestones"];

  const { data: proposal, error } = await supabase
    .from("proposals")
    .insert({
      // Required metadata
      proposal_id: proposalId,
      lead_id,
      creator_email,
      passcode,
      stage: "justCreated",

      // Cover page
      client_name: cover["Client Name"],
      provider_name: cover["Provider Name"],
      proposal_title: cover["Proposal Title"],
      proposal_date: cover["Date"],
      valid_until: cover["Proposal Valid Until"],

      // Narrative sections
      executive_summary: proposalMockData["Executive Summary"],
      problem_context: proposalMockData["Problem & Context"],
      solution_overview: proposalMockData["Solution Overview"],
      acceptance_completion_criteria:
        proposalMockData["Acceptance & Completion Criteria"],

      // Timeline summary
      total_duration: timeline["Total Duration"],

      // JSONB structured sections
      objectives: proposalMockData["Objectives & Success Criteria"],
      scope_of_work: proposalMockData["Scope of Work"],
      deliverables: proposalMockData["Deliverables"],
      assumptions_dependencies:
        proposalMockData["Assumptions & Dependencies"],
      client_responsibilities:
        proposalMockData["Client Responsibilities"],
      timeline_milestones: timeline["Milestones"],
      team_communication: proposalMockData["Team & Communication"],
      technology_architecture:
        proposalMockData["Technology & Architecture"],
      change_management:
        proposalMockData["Change Management Process"],
      pricing_commercial_terms:
        proposalMockData["Pricing & Commercial Terms"],
      risk_responsibility_boundaries:
        proposalMockData["Risk & Responsibility Boundaries"],
      next_steps: proposalMockData["Next Steps"],
      signatures: proposalMockData["Signatures"],

      // Signing
      signature_url: null,
      signed_at: null,
    })
    .select()
    .single();

  if (error || !proposal) {
    console.error("[createProposal] Supabase error:", error);
    throw new Error("Failed to create proposal");
  }

  // ✅ Validate returned shape
  const parsedProposal = ProposalSchema.safeParse(proposal);

  if (!parsedProposal.success) {
    console.error(
      "[createProposal] Invalid proposal shape:",
      parsedProposal.error,
    );
    throw new Error("Invalid proposal returned from database");
  }

  return parsedProposal.data;
};
