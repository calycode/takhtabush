import type { ZodType, z } from 'zod';

/**
 * Parse external input with a shared schema, throwing `ZodError` on failure.
 * Returns the schema's **output** type, so fields with defaults are required
 * downstream.
 */
export function parse<S extends ZodType>(schema: S, value: unknown): z.output<S> {
   return schema.parse(value) as z.output<S>;
}
