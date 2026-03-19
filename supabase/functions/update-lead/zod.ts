import { z } from "https://esm.sh/zod@3.23.8";

export const SelectedTimeSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
});

export const RangeSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
});

export const CreateSubmissionSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  companyName: z.string().optional(),
  industry: z.string().optional(),
  productIdea: z.string().optional(),
  build_scale: z.string().optional(),
  selectedTime: SelectedTimeSchema,
  monthlybudget: RangeSchema.optional(),
  estimateTimeline: RangeSchema.optional(),
});

export const CreateProposalInputSchema = z.object({
  lead_id: z.string().min(1),
  creator_email: z.string().email(),
});
