import { z } from 'zod';

// Schema for listing commentary with an optional limit
export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().positive().max(100).optional(),
});

// Schema for creating commentary
export const createCommentarySchema = z.object({
  minutes: z.number().int().nonnegative(),
  sequence: z.number().int(),
  period: z.string(),
  eventType: z.string(),
  actor: z.string().optional(),
  team: z.string().optional(),
  message: z.string().min(1, 'Message is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});
