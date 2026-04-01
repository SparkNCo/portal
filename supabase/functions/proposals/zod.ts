import { z } from "https://esm.sh/zod@3.23.8";

export const QuerySchema = z.object({
  passcode: z.string().min(1),
});

// const LeadSchema = z.object({
//   description: z.string().nullable(),
//   formatted_date: z.string().nullable(),
//   estimateTime_min: z.number().nullable(),
//   estimateTime_max: z.number().nullable(),
//   budget_min: z.number().nullable(),
//   budget_max: z.number().nullable(),
// });

// export const ProposalSchema = z.object({
//   proposal_id: z.string().uuid(),
//   lead_id: z.string().uuid().nullable(),
//   creator_email: z.string().email().nullable(),
//   passcode: z.string(),
//   stage: z.string().nullable(),
//   signature_url: z.string().nullable(),
//   signed_at: z.string().nullable(),
//   created_at: z.string(),
//   updated_at: z.string().nullable(),
//   client_name: z.string().nullable(),
//   provider_name: z.string().nullable(),
//   proposal_title: z.string().nullable(),
//   proposal_date: z.string().nullable(),
//   valid_until: z.string().nullable(),
//   summary: z.unknown().nullable(),
//   problem_and_context: z.unknown().nullable(),
//   solution_overview: z.unknown().nullable(),
//   objectives_and_success_criteria: z.unknown().nullable(),
//   pricing_and_commercial: z.unknown().nullable(),
//   timeline_and_milestones: z.unknown().nullable(),
//   deliverables: z.unknown().nullable(),
//   assumptions_and_dependencies: z.unknown().nullable(),
//   risk_and_responsabilities: z.unknown().nullable(),
//   change_management_process: z.unknown().nullable(),
//   next_steps: z.unknown().nullable(),
//   assurance_and_quality: z.unknown().nullable(),
//   history_and_case_studies: z.unknown().nullable(),
//   technology_and_architecture: z.unknown().nullable(),
//   team_and_communication: z.unknown().nullable(),
//   disclaimer: z.unknown().nullable(),
//   signatures: z.unknown().nullable(),
//   summary_items: z.unknown().nullable(),
// });

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

export const ProposalWithLeadSchema = z.object({
  proposal_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable(),
  creator_email: z.string().email().nullable(),
  passcode: z.string(),
  stage: z.string().nullable(),

  /* ---------------- COVER PAGE ---------------- */

  client_name: z.string().nullable(),
  provider_name: z.string().nullable(),
  proposal_title: z.string().nullable(),
  proposal_date: z.string().nullable(),
  valid_until: z.string().nullable(),

  /* ---------------- SECTIONS ---------------- */

  summary: z.unknown().nullable(),
  problem_and_context: z.unknown().nullable(),
  solution_overview: z.unknown().nullable(),
  disclaimer: z.unknown().nullable(),
  objectives_and_success_criteria: z.unknown().nullable(),
  deliverables: z.unknown().nullable(),
  assumptions_and_dependencies: z.unknown().nullable(),
  team_and_communication: z.unknown().nullable(),
  technology_and_architecture: z.unknown().nullable(),
  change_management_process: z.unknown().nullable(),
  pricing_and_commercial: z.unknown().nullable(),
  risk_and_responsabilities: z.unknown().nullable(),
  assurance_and_quality: z.unknown().nullable(),
  history_and_case_studies: z.unknown().nullable(),
  timeline_and_milestones: z.unknown().nullable(),
  next_steps: z.unknown().nullable(),

  /* ---------------- SIGNING ---------------- */

  signature_url: z.string().nullable(),
  signed_at: z.string().nullable(),

  /* ---------------- AUDIT ---------------- */

  created_at: z.string(),
  updated_at: z.string().nullable(),

  /* ---------------- LEAD JOIN ---------------- */

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

// export const ProposalUpdatesSchema = ProposalSchema.partial()
//   .extend({
//     lead: LeadSchema.optional(),
//   })
//   .strict();

// export const UpdateProposalBodySchema = z.object({
//   passcode: z.string().min(1),
//   updates: ProposalUpdatesSchema,
// });

/* ---------- Generic editor block ---------- */
const BlockSchema = z
  .object({
    type: z.string(),
  })
  .passthrough();

/* ---------- Lead ---------- */
const LeadSchema = z.object({
  description: z.string().nullable(),
  formatted_date: z.string().nullable(),
  estimateTime_min: z.number().nullable(),
  estimateTime_max: z.number().nullable(),
  budget_min: z.number().nullable(),
  budget_max: z.number().nullable(),
});

/* ---------- Proposal ---------- */
export const ProposalSchema = z.object({
  client_name: z.string().nullable().optional(),
  provider_name: z.string().nullable().optional(),
  proposal_title: z.string().nullable().optional(),
  proposal_date: z.string().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  disclaimer: z.array(BlockSchema).optional(),
  summary: z.array(BlockSchema).optional(),
  problem_and_context: z.array(BlockSchema).optional(),
  solution_overview: z.array(BlockSchema).optional(),
  acceptance_completion_criteria: z.array(BlockSchema).optional(),
  objectives_and_success_criteria: z.array(BlockSchema).optional(),
  scope_of_work: z.array(BlockSchema).optional(),
  deliverables: z.array(BlockSchema).optional(),
  assumptions_and_dependencies: z.array(BlockSchema).optional(),
  client_responsibilities: z.array(BlockSchema).optional(),
  history_and_case_studies: z.array(BlockSchema).optional(),
  total_duration: z.string().optional(),
  timeline_and_milestones: z.array(BlockSchema).optional(),
  risk_and_responsabilities: z.array(BlockSchema).optional(),
  assurance_and_quality: z.array(BlockSchema).optional(),
  team_and_communication: z.array(BlockSchema).optional(),
  technology_and_architecture: z.array(BlockSchema).optional(),
  change_management_process: z.array(BlockSchema).optional(),
  pricing_and_commercial: z.array(BlockSchema).optional(),
  next_steps: z.array(BlockSchema).optional(),
  signatures: z.any().optional(),
  stage: z.string().optional(),
  signature_url: z.string().nullable().optional(),
  signed_at: z.string().nullable().optional(),
});

/* ---------- Update schema ---------- */
export const ProposalUpdatesSchema = ProposalSchema.partial()
  .extend({
    lead: LeadSchema.optional(),
  })
  .strict();

/* ---------- Request body ---------- */
export const UpdateProposalBodySchema = z.object({
  passcode: z.string().min(1),
  updates: ProposalUpdatesSchema,
});

export const CreateProposalSchema = z.object({
  // IDs / metadata
  proposal_id: z.string(),
  lead_id: z.string(),
  creator_email: z.string().email(),
  passcode: z.string(),
  stage: z.string(),

  // Cover page
  client_name: z.string(),
  provider_name: z.string(),
  proposal_title: z.string(),
  proposal_date: z.string(),
  valid_until: z.string(),

  // JSONB sections
  summary: z.any(),

  problem_and_context: z.any(),

  solution_overview: z.any(),

  objectives_and_success_criteria: z.any(),

  pricing_and_commercial: z.any(),

  timeline_and_milestones: z.any(),

  deliverables: z.any(),

  assumptions_and_dependencies: z.any(),

  change_management_process: z.any(),

  risk_and_responsabilities: z.any(),

  next_steps: z.any(),

  disclaimer: z.any(),

  assurance_and_quality: z.any(),

  history_and_case_studies: z.any(),

  technology_and_architecture: z.any(),

  team_and_communication: z.any(),

  // Signing
  signature_url: z.string().nullable(),
  signed_at: z.string().nullable(),
});
