import { z } from 'zod';
import { isoDateSchema } from './common';

/** A same-site relative path, so a magic link cannot become an open redirect. */
export const safeNextPathSchema = z
   .string()
   .max(2048)
   .refine(
      (value) => value.startsWith('/') && !value.startsWith('//') && !value.includes('\\'),
      'next must be a same-site path',
   );

export const requestMagicLinkInputSchema = z.object({
   email: z.string().email().max(320),
   /** Required only when the deployment sets `OWNER_INVITE_TOKEN` (SPEC A3.2). */
   invite: z.string().max(200).optional(),
   /** Where to return after sign-in, e.g. an OAuth authorization request. */
   next: safeNextPathSchema.optional(),
});

export type RequestMagicLinkInput = z.infer<typeof requestMagicLinkInputSchema>;

export const verifyMagicLinkInputSchema = z.object({
   token: z.string().min(1),
});

export type VerifyMagicLinkInput = z.infer<typeof verifyMagicLinkInputSchema>;

/** First-run setup creates the owner account without email delivery. */
export const setupOwnerInputSchema = z.object({
   email: z.string().email().max(320),
   token: z.string().min(1).max(500),
});

export type SetupOwnerInput = z.infer<typeof setupOwnerInputSchema>;

export const authStatusSchema = z.object({
   initialized: z.boolean(),
   setupRequired: z.boolean(),
   setupEnabled: z.boolean(),
});

export type AuthStatus = z.infer<typeof authStatusSchema>;

export const userSchema = z.object({
   id: z.string(),
   email: z.string().email(),
   displayName: z.string(),
   isOwner: z.boolean(),
   createdAt: isoDateSchema,
   updatedAt: isoDateSchema,
});

export type User = z.infer<typeof userSchema>;

export const updateMeInputSchema = z.object({
   displayName: z.string().min(1).max(120).optional(),
});

export type UpdateMeInput = z.infer<typeof updateMeInputSchema>;

/** An active sign-in session shown on the settings screen (SPEC §3.3). */
export const sessionInfoSchema = z.object({
   id: z.string(),
   userAgent: z.string().nullable(),
   createdAt: isoDateSchema,
   expiresAt: isoDateSchema,
   current: z.boolean(),
});

export type SessionInfo = z.infer<typeof sessionInfoSchema>;

export const meResponseSchema = z.object({
   user: userSchema,
   csrfToken: z.string(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
