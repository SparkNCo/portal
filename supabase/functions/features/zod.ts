import { z } from "https://esm.sh/zod@3.23.8";

export const QuerySchema = z.object({
  submission_id: z.string().min(1, "submission_id is required"),
});

export const FeatureSchema = z.object({
  id: z.string(),
  proposal_id: z.string().nullable(),
  submission_id: z.string(),
  feature_name: z.string(),
  description: z.string().nullable(),
  purpose: z.string().nullable(),
  integration_text: z.string().nullable(),
  tech_constraints: z.string().nullable(),
  created_at: z.string(),
});

export const FeaturesSchema = z.array(FeatureSchema);

export const FeatureInputSchema = z.object({
  title: z.string().optional(),
  integrations: z.string().optional(),
  description: z.string().optional(),
  purpose: z.string().optional(),
  tech_constraints: z.string().optional(),
  sort_order: z.number().optional(),
});

export const CreateRequirementsSchema = z.object({
  proposal_id: z.string().min(1),
  submission_id: z.string().optional(),
  features: z.array(FeatureInputSchema).min(1),
  discovery_state: z.string().optional(),
  estimateTime_min: z.number().optional(),
  estimateTime_max: z.number().optional(),
  budget_min: z.string().optional(),
  budget_max: z.string().optional(),
  description: z.string().optional(),
  lead_id: z.string().optional(),
});
