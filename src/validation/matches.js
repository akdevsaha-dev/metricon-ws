import { z } from 'zod';

export const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
};

export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createMatchSchema = z.object({
  sport: z.string().min(1, { message: "sport must not be empty" }),
  homeTeam: z.string().min(1, { message: "homeTeam must not be empty" }),
  awayTeam: z.string().min(1, { message: "awayTeam must not be empty" }),
  startTime: z.string().refine(
    (val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date.toISOString() === val;
    },
    { message: "Must be a valid ISO date string" }
  ),
  endTime: z.string().refine(
    (val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date.toISOString() === val;
    },
    { message: "Must be a valid ISO date string" }
  ),
  homeScore: z.coerce.number().int().nonnegative().optional(),
  awayScore: z.coerce.number().int().nonnegative().optional(),
}).superRefine((val, ctx) => {
  if (val.startTime && val.endTime) {
    const start = new Date(val.startTime).getTime();
    const end = new Date(val.endTime).getTime();

    if (end <= start) { 
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endTime must be chronologically after startTime',
        path: ['endTime'],
      });
    }
  }
});

export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
});
