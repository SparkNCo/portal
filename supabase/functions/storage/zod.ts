// @ts-nocheck
import { z } from "https://esm.sh/zod@3.23.8";

export const DocumentSchema = z.object({
  id: z.number(),
  link: z.string().url(),
  size: z.string(),
  category: z.string().nullable(),
  owner_id: z.string().uuid(),
  file_name: z.string(),
  created_at: z.string(),
});

export const GetStorageDataQuerySchema = z.object({
  user_id: z.string().uuid(),
});

export const GetStorageDataResponseSchema = z.object({
  success: z.boolean(),
  count: z.number(),
  documents: z.array(DocumentSchema),
});

export const UpdateStorageEntrySchema = z
  .object({
    id: z.number(),
    category: z.string().min(1).optional(),
    link: z.string().url().optional(),
    size: z.string().optional(),
    file_name: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      const { id, ...updates } = data;
      return Object.keys(updates).length > 0;
    },
    {
      message: "No fields provided to update",
      path: [],
    },
  );

export const UpdateStorageEntryResponseSchema = z.object({
  success: z.literal(true),
  document: DocumentSchema,
});

export const UploadStorageInputSchema = z.object({
  file: z.instanceof(File),
  bucket: z.string().min(1),
  path: z.string().min(1),
  user_id: z.string().uuid(),
  email: z.string(),
  initiative_id: z.string(),
  category: z.string().min(1),
});

export const UploadStorageResponseSchema = z.object({
  success: z.literal(true),
  storage: z.object({
    bucket: z.string(),
    path: z.string(),
    contentType: z.string(),
    size: z.number(),
  }),
  document: DocumentSchema,
});
