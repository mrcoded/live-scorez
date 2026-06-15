import { z } from 'zod';

// Constant for match statuses in lowercase
export const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
} as const;

// Helper function to validate ISO 8601 date string format
const isISOString = (val: string) => {
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
  return isoRegex.test(val) && !isNaN(Date.parse(val));
};

// Schema for listing matches with an optional limit (coerced positive integer <= 100)
export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// Schema for match ID parameter (coerced positive integer)
export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Schema for creating a match
export const createMatchSchema = z.object({
  sport: z.string().min(1, 'Sport is required'),
  homeTeam: z.string().min(1, 'Home team is required'),
  awayTeam: z.string().min(1, 'Away team is required'),
  startTime: z.string().refine(isISOString, {
    message: 'startTime must be a valid ISO date string',
  }),
  endTime: z.string().refine(isISOString, {
    message: 'endTime must be a valid ISO date string',
  }),
  homeScore: z.coerce.number().int().nonnegative().optional(),
  awayScore: z.coerce.number().int().nonnegative().optional(),
}).superRefine((data, ctx) => {
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endTime must be chronologically after startTime',
      path: ['endTime'],
    });
  }
});

// Schema for updating a match score
export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
});
