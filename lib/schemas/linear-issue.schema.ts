import { z } from "zod";

export const NullableString = z.string().nullable();
export const NullableDateString = z.string().datetime().nullable();

export const CommentSchema = z.object({
  bodyData: z.any().nullable(), // Linear returns rich JSON here
  createdAt: z.string().datetime(),
  editedAt: z.string().datetime().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  user: z.string().nullable(),
});

export const CycleSchema = z.object({
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  isActive: z.boolean(),
  isPast: z.boolean(),
  isFuture: z.boolean(),
});

export const StateSchema = z.object({
  name: z.string(),
});

export const IssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),

  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),

  description: z.string().nullable(),
  activitySummary: z.string().nullable(),

  branchName: z.string().nullable(),

  completedAt: z.string().datetime().nullable(),
  canceledAt: z.string().datetime().nullable(),
  dueDate: z.string().datetime().nullable(),

  estimate: z.number().nullable(),

  priorityLabel: z.string(),
  prioritySortOrder: z.number(),

  number: z.number(),

  cycle: CycleSchema.nullable(),

  assignee: z.string().nullable(),
  creator: z.string().nullable(),

  labels: z.array(z.string()),

  comments: z.array(CommentSchema),

  documents: z.array(DocumentSchema),

  state: StateSchema.nullable(),
});

export const IssuesResponseSchema = z.array(IssueSchema);

export type LinearIssue = z.infer<typeof IssuesResponseSchema>;