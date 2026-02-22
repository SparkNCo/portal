import { z } from "https://esm.sh/zod@3.23.8";

export const GetIssuesQuerySchema = z.object({
  projectIds: z.string().min(1),
});


export const IssuesResponseSchema = z.object({
  data: z.object({
    issues: z.object({
      nodes: z.array(z.any()),
    }),
  }),
});

