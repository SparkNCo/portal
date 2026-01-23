import { z } from "zod";

export const InitiativeIdSchema = z.string().min(1);

export const IssueSchema = z.object({
  id: z.string(),
  createdAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  canceledAt: z.string().nullable(),
  dueDate: z.string().nullable(),
  estimate: z.number().nullable(),
  priorityLabel: z.string().nullable(),

  state: z.object({
    name: z.string(),
  }),

  assignee: z
    .object({
      displayName: z.string(),
    })
    .nullable(),

  labels: z.object({
    nodes: z.array(
      z.object({
        name: z.string(),
      }),
    ),
  }),

  cycle: z
    .object({
      startsAt: z.string().nullable(),
      endsAt: z.string().nullable(),
      isActive: z.boolean(),
      isPast: z.boolean(),
      isFuture: z.boolean(),
    })
    .nullable(),
});

export const MilestoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetDate: z.string().nullable(),
  status: z.string().nullable(),
  createdAt: z.string().nullable(),
  issues: z.object({
    nodes: z.array(IssueSchema),
  }),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  progress: z.number(),
  targetDate: z.string().nullable(),
  projectMilestones: z.object({
    nodes: z.array(MilestoneSchema),
  }),
});

export const RoadmapResponseSchema = z.object({
  projects: z.object({
    nodes: z.array(ProjectSchema),
  }),
});

export type RoadmapResponse = z.infer<typeof RoadmapResponseSchema>;
