import { z } from "https://esm.sh/zod@3.23.8";

export const QuerySchema = z.object({
  passcode: z.string().min(1),
});

const LeadSchema = z.object({
  description: z.string().nullable(),
  formatted_date: z.string().nullable(),
  estimateTime_min: z.number().nullable(),
  estimateTime_max: z.number().nullable(),
  budget_min: z.number().nullable(),
  budget_max: z.number().nullable(),
});

export const ProposalSchema = z.object({
  proposal_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable(),

  creator_email: z.string().email().nullable(),
  passcode: z.string(),

  stage: z.string().nullable(),
  signature_url: z.string().nullable(),
  signed_at: z.string().nullable(),

  created_at: z.string(),
  updated_at: z.string().nullable(),

  client_name: z.string().nullable(),
  provider_name: z.string().nullable(),
  proposal_title: z.string().nullable(),
  proposal_date: z.string().nullable(),
  valid_until: z.string().nullable(),

  executive_summary: z.string().nullable(),
  problem_context: z.string().nullable(),
  solution_overview: z.string().nullable(),
  acceptance_completion_criteria: z.string().nullable(),
  total_duration: z.string().nullable(),

  objectives: z.unknown().nullable(),
  scope_of_work: z.unknown().nullable(),
  deliverables: z.unknown().nullable(),
  assumptions_dependencies: z.unknown().nullable(),
  client_responsibilities: z.unknown().nullable(),
  timeline_milestones: z.unknown().nullable(),
  team_communication: z.unknown().nullable(),
  technology_architecture: z.unknown().nullable(),
  change_management: z.unknown().nullable(),
  pricing_commercial_terms: z.unknown().nullable(),
  risk_responsibility_boundaries: z.unknown().nullable(),
  next_steps: z.unknown().nullable(),
  signatures: z.unknown().nullable(),
});
export const SignProposalSchema = z.object({
  proposalId: z.string().min(1),
  signatureBase64: z
    .string()
    .min(1)
    .refine(
      (v) => /^data:image\/(png|jpeg|jpg);base64,/.test(v),
      "Invalid base64 image format",
    ),
});

export const ProposalLookupSchema = z.object({
  passcode: z.string(),
  stage: z.string(),
});

const LeadUpdatesSchema = z
  .object({
    description: z.string().nullable(),
    budget_min: z.union([z.string(), z.number()]).transform(String).nullable(),
    budget_max: z.union([z.string(), z.number()]).transform(String).nullable(),
    estimateTime_min: z.number().int().nullable(),
    estimateTime_max: z.number().int().nullable(),
  })
  .partial()
  .strict();

export const ProposalWithLeadSchema = z.object({
  proposal_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable(),
  creator_email: z.string().email().nullable(),
  passcode: z.string(),
  stage: z.string().nullable(),

  // Cover page
  client_name: z.string().nullable(),
  provider_name: z.string().nullable(),
  proposal_title: z.string().nullable(),
  proposal_date: z.string().nullable(),
  valid_until: z.string().nullable(),

  // Narrative
  executive_summary: z.string().nullable(),
  problem_context: z.string().nullable(),
  solution_overview: z.string().nullable(),
  acceptance_completion_criteria: z.string().nullable(),
  total_duration: z.string().nullable(),

  // JSONB sections
  objectives: z.unknown().nullable(),
  scope_of_work: z.unknown().nullable(),
  deliverables: z.unknown().nullable(),
  assumptions_dependencies: z.unknown().nullable(),
  client_responsibilities: z.unknown().nullable(),
  timeline_milestones: z.unknown().nullable(),
  team_communication: z.unknown().nullable(),
  technology_architecture: z.unknown().nullable(),
  change_management: z.unknown().nullable(),
  pricing_commercial_terms: z.unknown().nullable(),
  risk_responsibility_boundaries: z.unknown().nullable(),
  next_steps: z.unknown().nullable(),
  signatures: z.unknown().nullable(),

  // Signing / audit
  signature_url: z.string().nullable(),
  signed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),

  // Lead join
  lead: z
    .object({
      description: z.string().nullable(),
      formatted_date: z.string().nullable(),
      estimateTime_min: z.number().int().nullable(),
      estimateTime_max: z.number().int().nullable(),
      budget_min: z.number().nullable(),
      budget_max: z.number().nullable(),
    })
    .nullable(),
});

export const ProposalUpdatesSchema = ProposalSchema.partial()
  .extend({
    lead: LeadSchema.optional(),
  })
  .strict();

export const UpdateProposalBodySchema = z.object({
  passcode: z.string().min(1),
  updates: ProposalUpdatesSchema,
});
