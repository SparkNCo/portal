// @ts-nocheck
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export const IssueMetricSchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().optional(),
  project_id: z.string().optional(),
  status: z.string().optional(),
  label: z.string().optional(),
  date_collected: z.string().optional(), // date as ISO string
  count: z.number().int().optional(),
  points: z.number().optional(),
  cycle: z.string().optional(),
  created_at: z.string().optional(),
  cycle_issue_id: z.string().optional(),
  titles: z.array(z.string()).optional(),
});

export const CycleMetricSchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().optional(),
  project_id: z.string().optional(),
  cycle_id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  number: z.number().int().optional(),
  completed_at: z.string().nullable().optional(),
  scope_history: z.array(z.number()).optional(),
  completed_scope_history: z.array(z.number()).optional(),
  uncompleted_issues_upon_close: z.array(z.any()).optional(),
  created_at: z.string().optional(),
});

export type IssueMetric = z.infer<typeof IssueMetricSchema>;
export type CycleMetric = z.infer<typeof CycleMetricSchema>;
