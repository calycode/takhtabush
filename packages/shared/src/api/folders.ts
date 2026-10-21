import { z } from 'zod';
import { idSchema, isoDateSchema } from './common';

export const folderSchema = z.object({
   id: idSchema,
   ownerId: idSchema,
   name: z.string(),
   parentId: idSchema.nullable(),
   createdAt: isoDateSchema,
   deletedAt: isoDateSchema.nullable(),
});

export type Folder = z.infer<typeof folderSchema>;

export const createFolderInputSchema = z.object({
   name: z.string().min(1).max(120),
   parentId: idSchema.optional(),
});

export type CreateFolderInput = z.infer<typeof createFolderInputSchema>;

export const updateFolderInputSchema = z.object({
   name: z.string().min(1).max(120).optional(),
   parentId: idSchema.nullable().optional(),
});

export type UpdateFolderInput = z.infer<typeof updateFolderInputSchema>;
