import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const LeadSchema = z.object({
  id: z.number().int(),
  created_at: z.string().datetime(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  description: z.string().nullable().optional(),
  budget_min: z.number().nullable().optional(),
  budget_max: z.number().nullable().optional(),
  company: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  selected_date: z.string().nullable().optional(),
  selected_time: z.string().nullable().optional(),
  lead_id: z.string().uuid(),
  formatted_date: z.string().datetime().nullable().optional(),
  estimateTime_min: z.number().int().nullable().optional(),
  estimateTime_max: z.number().int().nullable().optional(),
  scheduling_url: z.string().url().nullable().optional(),
  email_sent: z.boolean().nullable().optional(),
  booking_status: z.string().nullable().optional(),
  email_sent_at: z.string().nullable().optional(),
  discovery_state: z.string().nullable().optional(),
  build_scale: z.string().nullable().optional(),
});

// POST
export const LeadInsertSchema = LeadSchema.omit({
  id: true,
  created_at: true,
}).extend({
  email: z.string().email(),
  lead_id: z.string().uuid(),
});

// PUT
export const LeadUpdateSchema = LeadSchema.partial().refine(
  (data) => data.id || data.lead_id,
  {
    message: "Either id or lead_id is required",
  },
);
