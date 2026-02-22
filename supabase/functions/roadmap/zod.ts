// @ts-nocheck
import { z } from "https://esm.sh/zod@3.23.8";

export const GetRoadMapDataQuerySchema = z.object({
  initiativeId: z.string().min(1),
});

export const RoadmapResponseSchema = z.object({
  initiative: z.object({
    id: z.string().uuid(),
    projects: z.object({
      nodes: z.array(z.any()),
    }),
  }),
});
