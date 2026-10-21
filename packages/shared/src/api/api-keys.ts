import { z } from 'zod';
import { idSchema, isoDateSchema } from './common';
import { MCP_ALL_SCOPES, mcpScopeSchema } from './mcp';

export const apiKeySchema = z.object({
   id: idSchema,
   name: z.string(),
   keyPrefix: z.string(),
   scopes: z.array(mcpScopeSchema),
   createdAt: isoDateSchema,
   expiresAt: isoDateSchema.nullable(),
   lastUsedAt: isoDateSchema.nullable(),
   revokedAt: isoDateSchema.nullable(),
});

export type ApiKey = z.infer<typeof apiKeySchema>;

export const createApiKeyInputSchema = z.object({
   name: z.string().min(1).max(80),
   scopes: z
      .array(mcpScopeSchema)
      .min(1)
      .default([...MCP_ALL_SCOPES]),
   /** Optional lifetime; omitted means the key never expires. */
   expiresInDays: z.number().int().min(1).max(3650).optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>;

/** Returned only once, at creation time. The secret is never stored in the clear. */
export const createApiKeyResponseSchema = z.object({
   apiKey: apiKeySchema,
   secret: z.string(),
});

export type CreateApiKeyResponse = z.infer<typeof createApiKeyResponseSchema>;
