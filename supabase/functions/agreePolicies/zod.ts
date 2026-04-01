// @ts-nocheck
import { z } from "https://esm.sh/zod@3.23.8";

export const ApprovePolicySchema = z.object({
  userId: z.string().uuid(),
  notionUrl: z.string().url().optional(),
});

export const ApprovePolicyResponseSchema = z.object({
  success: z.literal(true),
  user: z.object({
    id: z.string().uuid(),
    policies_approved: z.boolean(),
    policy_notion_url: z.string().url().nullable(),
  }),
});
